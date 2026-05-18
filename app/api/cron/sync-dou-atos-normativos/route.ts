/**
 * Cron Job: Sincronização de Atos Normativos do DOU (v2)
 *
 * Busca expandida com 15 termos + classificação editorial por IA.
 * Zero auto-import — todos os resultados vão para staging (aprovação manual).
 *
 * FLUXO:
 * 1. Auth (CRON_SECRET)
 * 2. Buscar DOU com SEARCH_TERMS_V2 (15 termos, recall > precision)
 * 3. Filtrar concretos + deduplicar por DB antes de gastar IA
 * 4. Classificar candidatos por IA em batches (EDITORIAL_BATCH_SIZE)
 * 5. Descartar score < EDITORIAL_AMBIGUOUS_FLOOR; criar DOUStagingDocument para o resto
 * 6. Detectar alterações na Lei 14.133 → LeiArticleNote
 * 7. Enviar email editorial se houver novos itens no staging
 *
 * Configuração: vercel.json → "0 8 * * *" (8h UTC = 5h BR)
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchLastWeek } from '@/lib/dou-api';
import { isAtoNormativoGeral } from '@/lib/dou-normative-filter';
import { detectModifications } from '@/lib/dou-change-detector';
import { normalizeScrapedText } from '@/lib/legislative-scrapers/normalize';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { classifyEditorialBatch, EDITORIAL_PROMPT_VERSION, type EditorialCandidate } from '@/lib/dou-editorial-classifier';
import { sendDouEditorialAlert, type DouEditorialAlertItem } from '@/lib/email';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';
import { extractIssuerFromDouHierarchy } from '@/lib/dou-issuer';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Termos expandidos do Clipping v2 — recall > precision (Apêndice 1 da spec)
const SEARCH_TERMS_V2 = [
  'lei 14.133 OR lei 14133 OR nova lei de licitações',
  'decreto licitação OR decreto contratação',
  'instrução normativa SEGES OR instrução normativa MGI',
  'portaria normativa licitação OR portaria normativa contratação',
  'portaria SEGES OR portaria MGI',
  'instrução normativa CGU OR portaria CGU',
  'parecer AGU OR orientação normativa AGU',
  'portaria SECEX OR resolução TCU',
  'decreto servidor público federal',
  'decreto teletrabalho OR decreto jornada servidor',
  'decreto contratos administrativos federais',
  'decreto regime jurídico único',
  'decreto regulamenta lei 14.133',
  'reorganização administração federal contratações',
  'fundo de contratações OR centralização compras governo',
];

const EDITORIAL_BATCH_SIZE = 5;
const EDITORIAL_SCORE_THRESHOLD = 70;
const EDITORIAL_AMBIGUOUS_FLOOR = 50;

// Mapeamento de changeType → LeiArticleNote.type
const CHANGE_TYPE_MAP: Record<string, string> = {
  altera: 'alteracao',
  revoga: 'revogacao',
  regulamenta: 'regulamentacao',
  complementa: 'comentario',
};

export async function GET(request: NextRequest) {
  // Auth fora do telemetry (auth != falha de cron)
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  console.log('[Sync DOU Normativos] Iniciando sincronização...');

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === 'true';
  const limitParam = searchParams.get('limit');
  const maxResults = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 500) : 100;

  let capturedResponse: NextResponse | null = null;

  try {
    await withCronTelemetry('sync-dou-atos-normativos-v2', async () => {
      capturedResponse = await runV2(dryRun, maxResults);
      // Sucesso/falha do runV2 já está na response; aqui só registramos
      // telemetria mínima (runV2 tem stats próprios mas não expostos).
      return { metadata: { v2: true, dryRun } };
    });
    return capturedResponse ?? NextResponse.json({ success: false, error: 'runV2 did not return a response' }, { status: 500 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * DOU Clipping v2 — busca expandida + IA editorial + zero auto-import.
 * Spec: docs/superpowers/specs/2026-05-03-dou-clipping-v2-design.md
 */
async function runV2(dryRun: boolean, maxResults: number): Promise<NextResponse> {
  console.log('[Sync DOU v2] Iniciando — termos:', SEARCH_TERMS_V2.length);

  const stats = {
    totalBuscados: 0,
    filtradosPorConcreto: 0,
    duplicados: 0,
    classificadosIA: 0,
    descartadosScoreBaixo: 0,
    enviadosParaStaging: 0,
    ambiguos: 0,
    alteracoesDetectadas: 0,
    notasLeiCriadas: 0,
    erros: 0,
    detalhes: [] as string[],
  };

  // 1. Buscar com 15 termos
  const allResults = new Map<string, Awaited<ReturnType<typeof searchLastWeek>>[number]>();
  for (const term of SEARCH_TERMS_V2) {
    try {
      const termResults = await searchLastWeek(term, undefined, maxResults);
      for (const r of termResults) {
        if (!allResults.has(r.href)) allResults.set(r.href, r);
      }
    } catch (error) {
      apiLogger.error({ err: error }, `[Sync DOU v2] Erro busca "${term}":`);
      stats.erros++;
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  const results = Array.from(allResults.values());
  stats.totalBuscados = results.length;
  console.log(`[Sync DOU v2] ${results.length} resultados únicos`);

  if (results.length === 0) {
    return NextResponse.json({ success: true, version: 'v2', message: 'Nenhum resultado', stats, dryRun });
  }

  // 2. Filtrar atos concretos + dedup por DB antes de gastar IA
  const candidatesForAI: Array<{
    raw: Awaited<ReturnType<typeof searchLastWeek>>[number];
    cleanTitle: string;
    cleanAbstract: string;
  }> = [];

  for (const r of results) {
    const cleanTitle = r.title.replace(/<[^>]*>/g, '').trim();
    const cleanAbstract = normalizeScrapedText(r.abstract || '');

    if (isAtoNormativoGeral(cleanTitle, r.abstract) === 'concreto') {
      stats.filtradosPorConcreto++;
      continue;
    }

    const dupDoc = await prisma.document.findFirst({
      where: { OR: [{ douUrl: r.href }, { title: { equals: cleanTitle, mode: 'insensitive' } }] },
      select: { id: true },
    });
    if (dupDoc) { stats.duplicados++; continue; }

    const dupStaging = await prisma.dOUStagingDocument.findFirst({
      where: { url: r.href },
      select: { id: true },
    });
    if (dupStaging) { stats.duplicados++; continue; }

    const dupAct = await prisma.legislativeAct.findFirst({
      where: { title: { equals: cleanTitle, mode: 'insensitive' } },
      select: { id: true },
    });
    if (dupAct) { stats.duplicados++; continue; }

    candidatesForAI.push({ raw: r, cleanTitle, cleanAbstract });
  }
  console.log(`[Sync DOU v2] ${candidatesForAI.length} candidatos pra IA`);

  // 3. Classificar IA em batches de EDITORIAL_BATCH_SIZE
  const newStagingItems: DouEditorialAlertItem[] = [];

  for (let i = 0; i < candidatesForAI.length; i += EDITORIAL_BATCH_SIZE) {
    const batch = candidatesForAI.slice(i, i + EDITORIAL_BATCH_SIZE);
    let result;
    try {
      result = await classifyEditorialBatch(
        batch.map((b): EditorialCandidate => ({
          title: b.cleanTitle,
          abstract: b.cleanAbstract,
          hierarchyStr: b.raw.hierarchyStr,
        })),
      );
      stats.classificadosIA += batch.length;
    } catch (error) {
      // Batch context na log pra rastrear quais items se perderam.
      const titles = batch.map((b) => b.cleanTitle.substring(0, 60)).join(' | ');
      apiLogger.error({ err: error }, `[Sync DOU v2] Erro IA batch (${batch.length} items: ${titles}):`);
      stats.erros++;
      continue;
    }

    for (let j = 0; j < batch.length; j++) {
      const cand = batch[j];
      const cls = result.classifications[j];

      // 4. Detectar alterações em legislação existente (mesma lógica do legacy).
      // Roda ANTES do score gate pra preservar semântica do fluxo legacy:
      // todo item novo (deduped) é avaliado pra detectar alterações na Lei 14.133,
      // independente do score editorial. Roda também ANTES do insert staging
      // pra evitar duplicação de LeiArticleNote em race com cron concorrente
      // (P2002 no insert staging cairia no catch e poderia rodar o detect 2x).
      const modification = detectModifications(cand.cleanTitle, cand.raw.abstract);
      if (modification) {
        stats.alteracoesDetectadas++;
        if (!dryRun && modification.modifiesLei14133 && modification.affectedArticles.length > 0) {
          for (const artNumber of modification.affectedArticles) {
            try {
              await prisma.leiArticleNote.create({
                data: {
                  articleNumber: artNumber,
                  type: CHANGE_TYPE_MAP[modification.changeType] || 'comentario',
                  title: `${modification.changeType === 'altera' ? 'Alterado' : modification.changeType === 'revoga' ? 'Revogado' : 'Regulamentado'} por: ${cand.cleanTitle.substring(0, 100)}`,
                  description: cand.cleanAbstract || null,
                  detectedBy: 'auto-sync-dou-v2',
                  isPublic: false,
                  adminReviewed: false,
                },
              });
              stats.notasLeiCriadas++;
            } catch (e) {
              apiLogger.error({ err: e }, '[Sync DOU v2] Erro LeiArticleNote:');
            }
          }
        }
      }

      if (cls.score < EDITORIAL_AMBIGUOUS_FLOOR) {
        stats.descartadosScoreBaixo++;
        if (dryRun) {
          stats.detalhes.push(`[DESCARTE score=${cls.score}] ${cand.cleanTitle.substring(0, 80)}`);
        }
        continue;
      }

      const isAmbiguous = cls.score < EDITORIAL_SCORE_THRESHOLD || cls.ambiguous;
      if (isAmbiguous) stats.ambiguos++;

      // Parse data
      let parsedDate: Date | undefined;
      try {
        const [d, m, y] = cand.raw.date.split('/').map(Number);
        parsedDate = new Date(y, m - 1, d);
      } catch { parsedDate = undefined; }

      if (dryRun) {
        stats.enviadosParaStaging++;
        stats.detalhes.push(`[STAGING score=${cls.score}${isAmbiguous ? ' AMB' : ''}] ${cand.cleanTitle.substring(0, 80)}`);
        continue;
      }

      try {
        const created = await prisma.dOUStagingDocument.create({
          data: {
            douId: cand.raw.id || cand.raw.href,
            title: cand.cleanTitle,
            abstract: cand.raw.abstract || '',
            url: cand.raw.href,
            section: cand.raw.section || 'do1',
            publishDate: cand.raw.date || new Date().toLocaleDateString('pt-BR'),
            hierarchyStr: cand.raw.hierarchyStr,
            category: 'ato_normativo',
            approvalStatus: 'pending',
            confidence: cls.score,
            reasoning: JSON.stringify([cls.reason]),
            isRelevant: true,
            requiresReview: true,
            imported: false,
            // === Enrichment v2 ===
            editorialScore: cls.score,
            editorialReason: cls.reason,
            editorialSummary: cls.summary,
            editorialAffects: JSON.stringify(cls.affects),
            editorialActType: cls.actType,
            editorialAmbiguous: isAmbiguous,
            editorialModel: result.model,
            editorialPromptVer: result.promptVersion,
            editorialClassifiedAt: new Date(),
            source: 'cron',
          },
        });
        stats.enviadosParaStaging++;
        newStagingItems.push({
          id: created.id,
          title: cand.cleanTitle,
          score: cls.score,
          reason: cls.reason,
          summary: cls.summary,
          affects: cls.affects,
          actType: cls.actType,
          issuer: extractIssuerFromDouHierarchy(cand.raw.hierarchyStr || ''),
          publishDate: cand.raw.date || '',
          douUrl: cand.raw.href,
          ambiguous: isAmbiguous,
        });
      } catch (error) {
        // Race com cron concorrente: douId @unique pode colidir
        if ((error as { code?: string }).code === 'P2002') {
          stats.duplicados++;
          continue;
        } else {
          apiLogger.error({ err: error }, '[Sync DOU v2] Erro insert staging:');
          stats.erros++;
          continue;
        }
      }
    }

    // Rate limiting entre batches IA
    await new Promise((res) => setTimeout(res, 1000));
  }

  // 5. Email se houver >=1 staging novo (e não-dryrun)
  if (!dryRun && newStagingItems.length > 0) {
    try {
      const sent = await sendDouEditorialAlert(newStagingItems);
      console.log(`[Sync DOU v2] Email ${sent ? 'enviado' : 'falhou'}: ${newStagingItems.length} itens`);
    } catch (e) {
      apiLogger.error({ err: e }, '[Sync DOU v2] Erro envio email:');
      stats.erros++;
    }
  }

  console.log('[Sync DOU v2] Concluído:', stats);
  return NextResponse.json({
    success: true,
    version: 'v2',
    promptVersion: EDITORIAL_PROMPT_VERSION,
    model: PRIMARY_GEMINI_MODEL,
    message: `Staging: ${stats.enviadosParaStaging} (${stats.ambiguos} ambíguos), descartados: ${stats.descartadosScoreBaixo}`,
    stats,
    dryRun,
  });
}

