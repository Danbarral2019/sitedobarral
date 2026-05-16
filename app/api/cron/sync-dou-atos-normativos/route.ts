/**
 * Cron Job: Sincronização de Atos Normativos do DOU
 *
 * Busca atos normativos relevantes no DOU, filtra atos concretos,
 * auto-aprova atos de autoridades competentes (Presidência, MGI/SEGES),
 * detecta alterações na Lei 14.133 e em atos existentes.
 *
 * FLUXO:
 * 1. Auth (CRON_SECRET)
 * 2. Buscar DOU (searchLastWeek) → resultados brutos
 * 3. Classificar (DOUClassifier) → filtrar ATO_NORMATIVO + FONTE_AGU + SUMULA
 * 4. Para cada resultado:
 *    a. isAtoNormativoGeral()? → 'concreto' = pular
 *    b. Deduplicar (Document.douUrl + LegislativeAct.fullNumber)
 *    c. shouldAutoApprove()?
 *       → SIM: criar Document + LegislativeAct
 *       → NÃO: criar DOUStagingDocument
 * 5. Detectar alterações (detectModifications)
 * 6. Retornar stats
 *
 * Configuração: vercel.json → "0 8 * * *" (8h UTC = 5h BR)
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchLastWeek } from '@/lib/dou-api';
import { DOUClassifier, DOUDocumentCategory } from '@/lib/dou-classifier';
import { isAtoNormativoGeral, shouldAutoApprove, detectAtoType, isProcurementRelated } from '@/lib/dou-normative-filter';
import { detectModifications } from '@/lib/dou-change-detector';
import { scrapeContent } from '@/lib/dou-scraper';
import { LeiIndexer } from '@/lib/lei-indexer';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';
import { normalizeScrapedText } from '@/lib/legislative-scrapers/normalize';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { classifyEditorialBatch, EDITORIAL_PROMPT_VERSION, type EditorialCandidate } from '@/lib/dou-editorial-classifier';
import { sendDouEditorialAlert, type DouEditorialAlertItem } from '@/lib/email';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';
import { extractIssuerFromDouHierarchy } from '@/lib/dou-issuer';
import { getHierarchyLevel } from '@/lib/legislative-acts/hierarchy';
import { apiLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Limite de scrapes por execução (sync já faz 4 buscas pesadas)
const MAX_SCRAPE_PER_RUN = 5;
const MAX_CONTENT_CHARS = 50_000;

// Termos de busca focados em atos normativos
const SEARCH_TERMS = [
  'lei 14.133 OR lei 14133 OR nova lei de licitações',
  'decreto licitação OR decreto contratação',
  'instrução normativa SEGES OR instrução normativa MGI',
  'portaria normativa licitação OR portaria normativa contratação',
];

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

// Categorias relevantes do DOUClassifier
const RELEVANT_CATEGORIES = new Set<string>([
  DOUDocumentCategory.ATO_NORMATIVO,
  DOUDocumentCategory.FONTE_AGU,
  DOUDocumentCategory.SUMULA,
]);

// Mapeamento de categorias DOU → Document.category
const CATEGORY_MAP: Record<string, string> = {
  [DOUDocumentCategory.ATO_NORMATIVO]: 'legislacao',
  [DOUDocumentCategory.FONTE_AGU]: 'parecer',
  [DOUDocumentCategory.SUMULA]: 'sumula',
};

// hierarchyLevel via getHierarchyLevel() — fonte canônica em
// lib/legislative-acts/hierarchy.ts (aceita aliases 'mp' e 'on' usados aqui).

// Mapeamento de changeType → LeiArticleNote.type
const CHANGE_TYPE_MAP: Record<string, string> = {
  altera: 'alteracao',
  revoga: 'revogacao',
  regulamenta: 'regulamentacao',
  complementa: 'comentario',
};

export async function GET(request: NextRequest) {
  console.log('[Sync DOU Normativos] Iniciando sincronização...');

  try {
    // 1. Auth
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    const limitParam = searchParams.get('limit');
    const maxResults = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 500) : 100;

    const v2Enabled = process.env.DOU_CLIPPING_V2_ENABLED === 'true';
    if (v2Enabled) {
      return await runV2(dryRun, maxResults);
    }
    // ↓ fluxo legacy continua abaixo (sem alteração)

    const stats = {
      totalBuscados: 0,
      filtradosPorClassificador: 0,
      filtradosPorConcreto: 0,
      filtradosPorIrrelevante: 0,
      duplicados: 0,
      autoAprovados: 0,
      enriquecidos: 0,
      actsScrapeados: 0,
      actsIndexados: 0,
      enviadosParaStaging: 0,
      alteracoesDetectadas: 0,
      notasLeiCriadas: 0,
      erros: 0,
      detalhes: [] as string[],
    };

    // 2. Buscar DOU com múltiplos termos
    const allResults = new Map<string, typeof results[0]>();
    let results: Awaited<ReturnType<typeof searchLastWeek>> = [];

    for (const term of SEARCH_TERMS) {
      try {
        const termResults = await searchLastWeek(term, undefined, maxResults);
        for (const r of termResults) {
          if (!allResults.has(r.href)) {
            allResults.set(r.href, r);
          }
        }
      } catch (error) {
        apiLogger.error(`[Sync DOU Normativos] Erro ao buscar "${term}":`, error);
        stats.erros++;
      }
      // Rate limiting entre buscas
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    results = Array.from(allResults.values());
    stats.totalBuscados = results.length;
    console.log(`[Sync DOU Normativos] ${results.length} resultados únicos encontrados`);

    if (results.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum resultado encontrado', stats, dryRun });
    }

    // Docs auto-aprovados para enriquecer com scraper após o loop principal
    const docsToScrape: Array<{ id: string; url: string }> = [];
    // Atos legislativos criados para scrape+index após o loop
    const actsToScrape: string[] = [];

    // 3. Classificar com DOUClassifier
    const classifications = DOUClassifier.classifyBatch(results);

    // 3.5. Classificar com IA os documentos com baixa confiança (max 10 por run)
    const aiStats = await DOUClassifier.classifyBatchWithAI(results, classifications, undefined, 10);
    if (aiStats.updated > 0) {
      console.log(`[Sync DOU Normativos] IA reclassificou ${aiStats.updated} docs`);
    }

    // 4. Processar cada resultado
    for (const [result, classification] of classifications.entries()) {
      try {
        // 4a. Filtrar por categoria relevante
        if (!RELEVANT_CATEGORIES.has(classification.category)) {
          stats.filtradosPorClassificador++;
          continue;
        }

        const cleanTitle = result.title.replace(/<[^>]*>/g, '').trim();
        // Abstract vindo da API DOU pode trazer whitespace/NBSP/boilerplate
        // residual quando o serviço inclui chrome do in.gov.br. Normalizamos
        // antes de persistir como ementa/content/description para o banco.
        const cleanAbstract = normalizeScrapedText(result.abstract || '');

        // 4b. Filtro de ato normativo geral vs concreto
        const normativeType = isAtoNormativoGeral(cleanTitle, result.abstract);
        if (normativeType === 'concreto') {
          stats.filtradosPorConcreto++;
          continue;
        }

        // 4b2. Filtro obrigatório: só importar se relacionado a licitações (título + abstract + órgão)
        if (!isProcurementRelated(cleanTitle, result.abstract, result.hierarchyStr)) {
          stats.filtradosPorIrrelevante++;
          continue;
        }

        // 4c. Deduplicar (por douUrl, staging, OU título no LegislativeAct/Document)
        const existingDoc = await prisma.document.findFirst({
          where: {
            OR: [
              { douUrl: result.href },
              { title: { equals: cleanTitle, mode: 'insensitive' } },
            ],
          },
        });
        if (existingDoc) {
          stats.duplicados++;
          continue;
        }

        const existingStaging = await prisma.dOUStagingDocument.findFirst({
          where: { url: result.href },
        });
        if (existingStaging) {
          stats.duplicados++;
          continue;
        }

        // Verificar LegislativeAct por título
        const existingLegAct = await prisma.legislativeAct.findFirst({
          where: { title: { equals: cleanTitle, mode: 'insensitive' } },
        });
        if (existingLegAct) {
          stats.duplicados++;
          continue;
        }

        // 4d. Detectar tipo de ato
        const atoType = detectAtoType(cleanTitle);

        // 4e. Verificar se deve auto-aprovar
        const autoApprove = normativeType === 'geral' &&
          shouldAutoApprove(cleanTitle, result.hierarchyStr, atoType);

        // Parse da data
        let parsedDate: Date | undefined;
        try {
          const [day, month, year] = result.date.split('/').map(Number);
          parsedDate = new Date(year, month - 1, day);
        } catch {
          parsedDate = undefined;
        }

        if (dryRun) {
          stats.detalhes.push(
            `${autoApprove ? '[AUTO]' : '[STAGING]'} ${cleanTitle.substring(0, 80)}... (tipo: ${atoType || 'n/a'}, class: ${normativeType})`
          );
          if (autoApprove) stats.autoAprovados++;
          else stats.enviadosParaStaging++;
        } else if (autoApprove) {
          // --- AUTO-APROVAR: criar Document + LegislativeAct ---
          await prisma.$transaction(async (tx) => {
            const documentCategory = CATEGORY_MAP[classification.category] || 'legislacao';

            const newDoc = await tx.document.create({
              data: {
                title: cleanTitle,
                description: cleanAbstract,
                type: 'link',
                url: result.href,
                category: documentCategory,
                isPublic: true,
                tags: JSON.stringify(['ato_normativo', atoType || 'outro'].filter(Boolean)),
                content: cleanAbstract,
                douUrl: result.href,
                douData: parsedDate,
                douSecao: result.section,
                reviewed: true,
                reviewedAt: new Date(),
                reviewedBy: 'auto-sync-dou',
                embeddingStatus: 'pending',
                // Satellite table (dual-write)
                metaDou: {
                  create: {
                    url: result.href,
                    data: parsedDate,
                    secao: result.section,
                  },
                },
              },
            });

            // Criar LegislativeAct se tiver tipo detectável
            if (atoType) {
              const fullNumberMatch = cleanTitle.match(
                /(?:decreto|portaria|instrução\s+normativa|in|lei|medida\s+provisória)\s+(?:[\w/]+\s+)?n[ºo°]?\s*([\d.]+(?:\/\d{4})?)/i
              );
              const number = fullNumberMatch ? fullNumberMatch[1] : '';
              const yearMatch = cleanTitle.match(/(\d{4})/);
              const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

              const fullNumber = `${atoType === 'in' ? 'IN' : atoType === 'on' ? 'ON' : atoType === 'mp' ? 'MP' : atoType.charAt(0).toUpperCase() + atoType.slice(1)} ${number}/${year}`;

              // Verificar se LegislativeAct já existe
              const existingAct = await tx.legislativeAct.findUnique({
                where: { fullNumber },
              });

              if (!existingAct && number) {
                const issuer = extractIssuerFromDouHierarchy(result.hierarchyStr);

                const newAct = await tx.legislativeAct.create({
                  data: {
                    type: atoType,
                    number,
                    year,
                    fullNumber,
                    title: cleanTitle,
                    ementa: cleanAbstract || cleanTitle,
                    issuer,
                    publishDate: parsedDate || new Date(),
                    hierarchyLevel: getHierarchyLevel(atoType),
                    officialUrl: result.href,
                    createdBy: 'auto-sync-dou',
                  },
                });
                actsToScrape.push(newAct.id);
              }
            }

            // Enriquecer com LeiIndexer (artigos da Lei 14.133 relacionados)
            try {
              const analysis = await LeiIndexer.analyzeDocument({
                id: newDoc.id,
                title: cleanTitle,
                category: documentCategory,
                tags: JSON.stringify([atoType]),
                content: cleanAbstract,
                description: cleanAbstract,
              });

              if (analysis.articles.length > 0) {
                const articleNumbers = LeiIndexer.resultToLeiArticles(analysis);
                await tx.document.update({
                  where: { id: newDoc.id },
                  data: { leiArticles: JSON.stringify(articleNumbers) },
                });
              }
            } catch (error) {
              apiLogger.error({ err: error }, `[Sync DOU Normativos] Erro LeiIndexer para ${newDoc.id}:`);
            }
          });

          // Coletar doc para enriquecimento com scraper (fora da transaction)
          const createdDoc = await prisma.document.findFirst({
            where: { douUrl: result.href },
            select: { id: true },
          });
          if (createdDoc) {
            docsToScrape.push({ id: createdDoc.id, url: result.href });
          }

          stats.autoAprovados++;
        } else {
          // --- STAGING: enviar para aprovação manual ---
          await prisma.dOUStagingDocument.create({
            data: {
              douId: result.href,
              title: cleanTitle,
              abstract: result.abstract || '',
              url: result.href,
              section: result.section || 'do1',
              publishDate: result.date || new Date().toLocaleDateString('pt-BR'),
              hierarchyStr: result.hierarchyStr,
              category: classification.category,
              approvalStatus: normativeType === 'ambiguo' ? 'pending' : classification.status,
              confidence: classification.confidence,
              reasoning: JSON.stringify(classification.reasoning),
              isRelevant: true,
              requiresReview: true,
              imported: false,
            },
          });

          stats.enviadosParaStaging++;
        }

        // 5. Detectar alterações em legislação existente
        const modification = detectModifications(cleanTitle, result.abstract);
        if (modification) {
          stats.alteracoesDetectadas++;

          if (!dryRun) {
            // 5a. Se modifica Lei 14.133 com artigos específicos → criar LeiArticleNote
            if (modification.modifiesLei14133 && modification.affectedArticles.length > 0) {
              for (const artNumber of modification.affectedArticles) {
                try {
                  await prisma.leiArticleNote.create({
                    data: {
                      articleNumber: artNumber,
                      type: CHANGE_TYPE_MAP[modification.changeType] || 'comentario',
                      title: `${modification.changeType === 'altera' ? 'Alterado' : modification.changeType === 'revoga' ? 'Revogado' : 'Regulamentado'} por: ${cleanTitle.substring(0, 100)}`,
                      description: cleanAbstract || null,
                      detectedBy: 'auto-sync-dou',
                      isPublic: false,
                      adminReviewed: false,
                    },
                  });
                  stats.notasLeiCriadas++;
                } catch (error) {
                  apiLogger.error({ err: error }, `[Sync DOU Normativos] Erro ao criar LeiArticleNote para art. ${artNumber}:`);
                }
              }
            }

            // 5b. Se modifica ato existente → buscar e sinalizar
            if (modification.modifiesExistingAct && modification.existingActRef) {
              const ref = modification.existingActRef;
              try {
                // Buscar LegislativeAct com número similar
                const existingActs = await prisma.legislativeAct.findMany({
                  where: {
                    type: ref.type,
                    number: { contains: ref.number },
                    ...(ref.year ? { year: ref.year } : {}),
                  },
                  take: 5,
                });

                if (existingActs.length > 0) {
                  // Criar nota de alteração para cada ato encontrado
                  for (const act of existingActs) {
                    console.log(
                      `[Sync DOU Normativos] Alteração detectada: "${cleanTitle.substring(0, 60)}" → ${act.fullNumber}`
                    );
                  }
                }
              } catch (error) {
                apiLogger.error({ err: error }, '[Sync DOU Normativos] Erro ao buscar ato existente:');
              }
            }
          } else {
            stats.detalhes.push(
              `[ALTERACAO] ${modification.changeType}: ${modification.modifiesLei14133 ? `Lei 14.133 arts: ${modification.affectedArticles.join(', ')}` : ''} ${modification.existingActRef ? `${modification.existingActRef.type} ${modification.existingActRef.number}` : ''}`
            );
          }
        }

        // Rate limiting entre processamento de documentos
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        stats.erros++;
        apiLogger.error({ err: error }, '[Sync DOU Normativos] Erro ao processar documento:');
      }
    }

    // 6. Enriquecer docs auto-aprovados com scraper cheerio
    if (!dryRun && docsToScrape.length > 0) {
      const toScrape = docsToScrape.slice(0, MAX_SCRAPE_PER_RUN);
      console.log(`[Sync DOU Normativos] Enriquecendo ${toScrape.length} documentos com scraper...`);

      for (const doc of toScrape) {
        try {
          const enriched = await scrapeContent(doc.url);
          if (enriched && enriched.caracteres > 0) {
            let content = enriched.conteudo;
            if (content.length > MAX_CONTENT_CHARS) {
              content = content.substring(0, MAX_CONTENT_CHARS) + `\n\n[... truncado: ${enriched.caracteres.toLocaleString('pt-BR')} caracteres no total]`;
            }

            await prisma.document.update({
              where: { id: doc.id },
              data: { content },
            });
            stats.enriquecidos++;
          }

          // Rate limiting entre scrapes
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          apiLogger.error({ err: error }, `[Sync DOU Normativos] Erro ao enriquecer ${doc.id}:`);
        }
      }

      console.log(`[Sync DOU Normativos] ${stats.enriquecidos}/${toScrape.length} documentos enriquecidos`);
    }

    // 6b. Scrape + index atos legislativos criados
    if (!dryRun && actsToScrape.length > 0) {
      const toScrapeActs = actsToScrape.slice(0, MAX_SCRAPE_PER_RUN);
      console.log(`[Sync DOU Normativos] Scraping+indexing ${toScrapeActs.length} atos legislativos...`);

      for (const actId of toScrapeActs) {
        try {
          const res = await scrapeAndIndexAct(actId);
          if (res.scraped) stats.actsScrapeados++;
          if (res.indexed) stats.actsIndexados++;

          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          apiLogger.error({ err: error }, `[Sync DOU Normativos] Erro ao scrape+index act ${actId}:`);
        }
      }

      console.log(`[Sync DOU Normativos] ${stats.actsScrapeados}/${toScrapeActs.length} atos scrapeados, ${stats.actsIndexados} indexados`);
    }

    // 7. Sincronizar staging: marcar imported=true onde URL já existe como Document
    if (!dryRun) {
      try {
        const pendingStaging = await prisma.dOUStagingDocument.findMany({
          where: { imported: false },
          select: { id: true, url: true },
        });

        for (const staging of pendingStaging) {
          const docExists = await prisma.document.findFirst({
            where: { douUrl: staging.url },
            select: { id: true },
          });
          if (docExists) {
            await prisma.dOUStagingDocument.update({
              where: { id: staging.id },
              data: { imported: true, importedAt: new Date(), documentId: docExists.id },
            });
          }
        }
      } catch (error) {
        apiLogger.error({ err: error }, '[Sync DOU Normativos] Erro ao sincronizar staging:');
      }
    }

    console.log('[Sync DOU Normativos] Sincronização concluída:', stats);

    return NextResponse.json({
      success: true,
      dryRun,
      message: `Processados: ${stats.autoAprovados} auto-aprovados, ${stats.enviadosParaStaging} para staging, ${stats.alteracoesDetectadas} alterações detectadas`,
      stats: { ...stats, aiClassified: aiStats.updated, aiErrors: aiStats.errors },
    });

  } catch (error) {
    apiLogger.error({ err: error }, '[Sync DOU Normativos] Erro fatal:');
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
      apiLogger.error(`[Sync DOU v2] Erro busca "${term}":`, error);
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

