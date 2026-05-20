import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeRelevanceTCU, suggestCoursesTCU } from '@/lib/tcu-module';
import { LeiIndexer } from '@/lib/lei-indexer';
import { identifyAndAlertHighlights } from '@/lib/tcu-highlight-analyzer';
import { verifyCronAuth } from '@/lib/cron-auth';
import { classifyDecision } from '@/lib/tribunal-scrapers/classifier';
import { setLeiArticles, stringifyLeiArticles } from '@/lib/lei-articles';
import {
  buildSummaryPrompt,
  callGemini,
  ENRICHMENT_DELAY_MS,
} from '@/lib/tcu-enrichment';
import { classifyTCUEditorial } from '@/lib/tcu-editorial-classifier';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

/**
 * Cron Job: Sincronização automática de acórdãos do TCU
 *
 * Busca os 500 acórdãos mais recentes da API de dados abertos do TCU,
 * filtra os relevantes para licitações/contratos, e importa apenas os novos.
 *
 * Pipeline completo pós-importação:
 * 1. Importa acórdãos novos da API do TCU
 * 2. Gera resumos executivos via Gemini AI (summary + description)
 * 3. Indexa artigos da Lei 14.133 relacionados via Gemini (leiArticles)
 * 4. Marca embeddings como 'pending' para indexação automática pelo cron de index-jobs
 *
 * Segurança: Requer CRON_SECRET ou Authorization header
 * Agendamento: Diário às 6h (vercel.json)
 */

// Permitir até 300s para importação + enriquecimento
export const maxDuration = 300;

const TCU_API_URL = 'https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos';
const PAGE_SIZE = 500;

interface TCUApiItem {
  key?: string;
  tipo?: string;
  numeroAcordao?: string;
  anoAcordao?: string;
  titulo?: string;
  sumario?: string;
  colegiado?: string;
  relator?: string;
  dataSessao?: string;
  situacao?: string;
  urlArquivo?: string;
  urlArquivoPDF?: string;
  urlAcordao?: string;
}

function mapearColegiado(colegiado: string | null | undefined): string {
  if (!colegiado) return 'Plenário';
  const c = colegiado.trim();
  if (/1[ªa]\s*c/i.test(c) || /primeira/i.test(c)) return 'Primeira Câmara';
  if (/2[ªa]\s*c/i.test(c) || /segunda/i.test(c)) return 'Segunda Câmara';
  return 'Plenário';
}

function construirUrlTCU(numero: number, ano: number, colegiado: string | null | undefined): string {
  const col = mapearColegiado(colegiado);
  return `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${numero}/${ano}/${encodeURIComponent(col)}`;
}

function parseDateTCU(dataSessao: string | undefined): Date | null {
  if (!dataSessao) return null;
  const parts = dataSessao.split('/');
  if (parts.length === 3) {
    const [dia, mes, ano] = parts;
    const date = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

// Enriquecimento via Gemini: prompt builder e HTTP client em lib/tcu-enrichment.ts
// (compartilhados com scripts/improve-tcu-descriptions.ts).

async function enrichNewDocuments(docIds: string[]): Promise<{
  summaries: number;
  leiIndexed: number;
  classified: number;
  enrichErrors: number;
}> {
  if (docIds.length === 0 || !process.env.GEMINI_API_KEY) {
    return { summaries: 0, leiIndexed: 0, classified: 0, enrichErrors: 0 };
  }

  console.log(`[Sync TCU] Enriquecendo ${docIds.length} novos acórdãos...`);

  const docs = await prisma.document.findMany({
    where: { id: { in: docIds } },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      category: true,
      tags: true,
      leiArticlesArr: true,
      tcuNumeroAcordao: true,
      tcuRelator: true,
      tcuOrgaoJulgador: true,
      tcuEmentaCompleta: true,
      metaTcu: {
        select: {
          ementaCompleta: true,
          area: true,
          tema: true,
          subtema: true,
        },
      },
    },
  });

  let summaries = 0;
  let leiIndexed = 0;
  let classified = 0;
  let enrichErrors = 0;

  for (const doc of docs) {
    // Fase 1: Indexar artigos da Lei 14.133 (roda primeiro para que o resumo possa citá-los)
    // Sempre persiste leiIndexedAt (mesmo articles=[]) para diferenciar "processado
    // sem matches" de "nunca processado" — habilita backfill idempotente.
    const now = new Date();
    try {
      const analysis = await LeiIndexer.analyzeDocument(doc, { minConfidence: 40 });
      const articles = analysis.articles.length > 0
        ? LeiIndexer.resultToLeiArticles(analysis)
        : null;
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          ...(articles ? setLeiArticles(articles) : {}),
          leiIndexedAt: now,
          leiIndexerError: null,
        },
      });
      if (articles) {
        leiIndexed++;
        doc.leiArticlesArr = articles.map(String);
      }
      await new Promise(resolve => setTimeout(resolve, ENRICHMENT_DELAY_MS));
    } catch (err) {
      enrichErrors++;
      const errMsg = err instanceof Error ? err.message : String(err);
      apiLogger.error({ err: errMsg }, `[Sync TCU] Erro Lei-index ${doc.title}:`);
      await prisma.document.update({
        where: { id: doc.id },
        data: { leiIndexedAt: now, leiIndexerError: errMsg.slice(0, 500) },
      }).catch(() => { /* update opcional, não bloqueia */ });
    }

    // Fase 2: Gerar resumo executivo via Gemini
    try {
      const prompt = buildSummaryPrompt(doc);
      const summary = await callGemini(prompt);

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          summary,
          description: summary,
          summaryGeneratedAt: new Date(),
          embeddingStatus: 'pending', // Re-indexar com nova descrição
        },
      });
      summaries++;
      await new Promise(resolve => setTimeout(resolve, ENRICHMENT_DELAY_MS));
    } catch (err) {
      enrichErrors++;
      apiLogger.error({ err: err instanceof Error ? err.message : err }, `[Sync TCU] Erro resumo ${doc.title}:`);
    }

    // Fase 3: Classificação editorial (área/tema/subtema) via taxonomia oficial TCU
    try {
      const classification = await classifyTCUEditorial({
        numeroAcordao: doc.tcuNumeroAcordao,
        title: doc.title,
        ementa: doc.tcuEmentaCompleta || doc.description || doc.title,
        relator: doc.tcuRelator,
        orgao: doc.tcuOrgaoJulgador,
      });

      const now = new Date();
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          tcuArea: classification.area,
          tcuTema: classification.tema,
          tcuSubtema: classification.subtema,
          tcuClassificadoEm: now,
          tcuRevisadoPorAdmin: false,
        },
      });
      await prisma.documentMetaTcu.upsert({
        where: { documentId: doc.id },
        create: {
          documentId: doc.id,
          area: classification.area,
          tema: classification.tema,
          subtema: classification.subtema,
          classificadoEm: now,
          revisadoPorAdmin: false,
        },
        update: {
          area: classification.area,
          tema: classification.tema,
          subtema: classification.subtema,
          classificadoEm: now,
          revisadoPorAdmin: false,
        },
      });
      classified++;
      await new Promise(resolve => setTimeout(resolve, ENRICHMENT_DELAY_MS));
    } catch (err) {
      enrichErrors++;
      apiLogger.error({ err: err instanceof Error ? err.message : err }, `[Sync TCU] Erro classificação editorial ${doc.title}:`);
    }
  }

  console.log(`[Sync TCU] Enriquecimento: ${summaries} resumos, ${leiIndexed} Lei-indexed, ${classified} classificados, ${enrichErrors} erros`);
  return { summaries, leiIndexed, classified, enrichErrors };
}

export async function GET(request: NextRequest) {
  // 1. Verificação de segurança (fora do telemetry — auth não conta como falha de cron)
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};

  try {
    await withCronTelemetry('sync-tcu-acordaos', async () => {
      console.log('[Sync TCU] Iniciando sincronização de acórdãos...');
      const startTime = Date.now();

    // 2. Buscar os 500 acórdãos mais recentes da API do TCU
    const url = `${TCU_API_URL}?inicio=0&quantidade=${PAGE_SIZE}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API TCU retornou ${response.status}: ${response.statusText}`);
    }

    const apiData: TCUApiItem[] = await response.json();

    if (!Array.isArray(apiData)) {
      throw new Error('Resposta da API TCU não é um array');
    }

    console.log(`[Sync TCU] ${apiData.length} acórdãos recebidos da API`);

    // 3. Filtrar relevantes para licitações/contratos
    const relevant: TCUApiItem[] = [];
    for (const item of apiData) {
      const titulo = item.titulo || '';
      const sumario = item.sumario || '';
      const { isRelevant, score } = analyzeRelevanceTCU(titulo, sumario);

      if (isRelevant && score >= 10) {
        relevant.push(item);
      }
    }

    console.log(`[Sync TCU] ${relevant.length} acórdãos relevantes (${Math.round(relevant.length / apiData.length * 100)}%)`);

    // 4. Verificar quais já existem no banco
    const existingPairs = await prisma.document.findMany({
      where: { category: 'acordao' },
      select: { acordaoNumero: true, acordaoAno: true },
    });

    const existingSet = new Set(
      existingPairs.map(e => `${e.acordaoNumero}-${e.acordaoAno}`)
    );

    const newItems = relevant.filter(item => {
      const num = parseInt(item.numeroAcordao || '0');
      const ano = parseInt(item.anoAcordao || '0');
      return num > 0 && ano > 0 && !existingSet.has(`${num}-${ano}`);
    });

    console.log(`[Sync TCU] ${newItems.length} acórdãos novos a importar`);

    // 5. Importar novos acórdãos
    let imported = 0;
    let errors = 0;
    let skippedDuplicates = 0;
    const newDocIds: string[] = [];

    for (const item of newItems) {
      try {
        const num = parseInt(item.numeroAcordao || '0');
        const ano = parseInt(item.anoAcordao || '0');
        const titulo = item.titulo || '';
        const sumario = item.sumario || '';
        const colegiado = item.colegiado || '';

        // Gerar título no formato padrão
        const title = `Acórdão TCU ${num}/${ano} - ${colegiado}`;

        // Construir URL
        const docUrl = construirUrlTCU(num, ano, colegiado);

        // Sugerir cursos
        const courses = suggestCoursesTCU(titulo, sumario);
        const mainCourse = courses[0] || '2';
        const isCommon = courses.length > 1;

        // Tags baseadas no colegiado e ano
        const tags = ['TCU', 'Acórdão', colegiado, `${ano}`].filter(Boolean);

        // Parsear data do julgamento
        const dataJulgamento = parseDateTCU(item.dataSessao);

        const created = await prisma.document.create({
          data: {
            title,
            description: sumario || titulo || '',
            url: docUrl,
            type: 'link',
            category: 'acordao',
            courseId: isCommon ? null : mainCourse,
            isCommon,
            isPublic: true,
            reviewed: true,
            reviewedAt: new Date(),
            reviewedBy: 'auto-sync-tcu',
            tags: JSON.stringify(tags),
            acordaoNumero: num,
            acordaoAno: ano,
            // Dual-write: flat fields (transition) + satellite table
            tcuNumeroAcordao: `${num}/${ano}`,
            tcuEmentaCompleta: sumario || null,
            tcuRelator: item.relator || null,
            tcuOrgaoJulgador: colegiado || null,
            tcuLinkPDF: item.urlArquivoPDF || item.urlArquivo || null,
            tcuDataJulgamento: dataJulgamento,
            tcuEnriquecidoEm: new Date(),
            tcuEnriquecimentoStatus: 'success',
            embeddingStatus: 'pending',
            metaTcu: {
              create: {
                numeroAcordao: `${num}/${ano}`,
                ementaCompleta: sumario || null,
                relator: item.relator || null,
                orgaoJulgador: colegiado || null,
                linkPDF: item.urlArquivoPDF || item.urlArquivo || null,
                dataJulgamento: dataJulgamento,
                enriquecidoEm: new Date(),
                enriquecimentoStatus: 'success',
              },
            },
          },
        });

        newDocIds.push(created.id);
        imported++;

        // Dual-write: upsert em TribunalDecision para /jurisprudencia
        try {
          const fullId = `TCU Acordao ${num}/${ano}`;
          const classification = await classifyDecision({
            title,
            ementa: sumario || titulo || '',
            tribunalCode: 'tcu',
          });

          await prisma.tribunalDecision.upsert({
            where: { fullIdentifier: fullId },
            create: {
              tribunalCode: 'tcu',
              tribunalName: 'Tribunal de Contas da União',
              decisionType: 'acordao',
              decisionNumber: `${num}/${ano}`,
              year: ano,
              fullIdentifier: fullId,
              title,
              ementa: sumario || titulo || '',
              relator: item.relator || null,
              orgaoJulgador: colegiado || null,
              dataJulgamento: dataJulgamento,
              url: docUrl,
              pdfUrl: item.urlArquivoPDF || item.urlArquivo || null,
              isRelevant: true,
              relevanceScore: classification.relevanceScore,
              themes: JSON.stringify(classification.themes),
              ...setLeiArticles(classification.leiArticles),
              suggestedCourses: classification.suggestedCourses || null,
              sourceApi: 'tcu-dados-abertos',
              sourceId: item.key || null,
              approvalStatus: 'auto_approved',
              confidence: classification.confidence,
              classificationReasoning: classification.reasoning,
              embeddingStatus: 'pending',
            },
            update: {}, // Idempotente: não sobrescreve se já existe
          });
        } catch (tdErr) {
          apiLogger.error({ err: tdErr instanceof Error ? tdErr.message : tdErr }, `[Sync TCU] Erro dual-write TribunalDecision ${num}/${ano}:`);
        }
      } catch (err) {
        // P2002 = unique constraint violation (race condition: outro run já criou).
        // A unique [acordaoNumero, acordaoAno, tcuOrgaoJulgador] em Document garante idempotência.
        if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
          skippedDuplicates++;
          console.log(`[Sync TCU] Pulado (já criado por execução concorrente): ${item.numeroAcordao}/${item.anoAcordao}`);
        } else {
          errors++;
          apiLogger.error({ err: err instanceof Error ? err.message : err }, `[Sync TCU] Erro ao importar ${item.numeroAcordao}/${item.anoAcordao}:`);
        }
      }
    }

    // 6. Enriquecer novos acórdãos (resumo Gemini + indexação Lei 14.133)
    const enrichment = await enrichNewDocuments(newDocIds);

    // 6b. Propagar summaries e leiArticles para TribunalDecision
    if (enrichment.summaries > 0 || enrichment.leiIndexed > 0) {
      try {
        const enrichedDocs = await prisma.document.findMany({
          where: { id: { in: newDocIds } },
          select: { acordaoNumero: true, acordaoAno: true, summary: true, leiArticlesArr: true },
        });

        for (const doc of enrichedDocs) {
          if (!doc.acordaoNumero || !doc.acordaoAno) continue;
          const fullId = `TCU Acordao ${doc.acordaoNumero}/${doc.acordaoAno}`;
          const updateData: Record<string, unknown> = {};
          if (doc.summary) updateData.summary = doc.summary;
          if (doc.leiArticlesArr.length > 0) updateData.leiArticlesArr = doc.leiArticlesArr;

          if (Object.keys(updateData).length > 0) {
            await prisma.tribunalDecision.update({
              where: { fullIdentifier: fullId },
              data: updateData,
            }).catch(() => { /* ignore if not found */ });
          }
        }
        console.log(`[Sync TCU] Propagados summaries/leiArticles para TribunalDecision`);
      } catch (propErr) {
        apiLogger.error({ err: propErr }, '[Sync TCU] Erro propagação TribunalDecision:');
      }
    }

    // 7. Identificar acórdãos com potencial editorial
    let highlightCount = 0;
    if (newDocIds.length > 0) {
      try {
        highlightCount = await identifyAndAlertHighlights(newDocIds);
      } catch (err) {
        apiLogger.error({ err: err }, '[Sync TCU] Erro na fase de highlights:');
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const result = {
      success: true,
      apiTotal: apiData.length,
      relevant: relevant.length,
      alreadyExists: relevant.length - newItems.length,
      newFound: newItems.length,
      imported,
      skippedDuplicates,
      errors,
      enrichment,
      highlights: highlightCount,
      elapsed: `${elapsed}s`,
    };

      console.log('[Sync TCU] Resultado:', result);
      responseBody = {
        message: `Sincronização TCU: ${imported} importados, ${enrichment.summaries} resumos, ${enrichment.leiIndexed} Lei-indexed, ${enrichment.classified} classificados`,
        ...result,
      };

      // Retorno para o wrapper de telemetria (vira ScraperHealthLog)
      return {
        itemsFound: relevant.length,
        itemsNew: imported,
        itemsError: errors,
        metadata: {
          apiTotal: apiData.length,
          alreadyExists: relevant.length - newItems.length,
          skippedDuplicates,
          enrichment,
          highlights: highlightCount,
          elapsed: `${elapsed}s`,
        },
      };
    });

    // Sucesso: devolve a response HTTP customizada construída dentro do callback.
    return NextResponse.json(responseBody);
  } catch (error) {
    // withCronTelemetry já chamou Sentry.captureException e gravou ScraperHealthLog (failure).
    // Aqui só formatamos a response HTTP de erro.
    return NextResponse.json(
      {
        error: 'Erro ao sincronizar acórdãos do TCU',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
