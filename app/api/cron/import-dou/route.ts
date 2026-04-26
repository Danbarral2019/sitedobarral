/**
 * Cron Job: Importacao Diaria de Documentos do DOU para Staging
 *
 * Endpoint chamado diariamente pelo Vercel Cron para buscar, classificar,
 * enriquecer e salvar documentos relevantes do Diario Oficial da Uniao
 * no staging para validacao manual posterior.
 *
 * FLUXO:
 * 1. Busca API oficial DOU (ultimos 7 dias)
 * 2. Classifica com DOUClassifier
 * 3. Salva em DOUStagingDocument:
 *    - Auto-aprovados: approvalStatus='auto_approved', imported=false
 *    - Pendentes: approvalStatus='pending', imported=false
 *    - Auto-rejeitados: approvalStatus='auto_rejected'
 * 4. Enriquece docs auto-aprovados/pendentes com scraper cheerio
 * 5. Limpa staging antigo (rejeitados >30d, importados >90d)
 * 6. Admin valida manualmente em /admin/dou-filtros
 *
 * Configuracao no vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/import-dou",
 *     "schedule": "0 10 * * *"  // 10h UTC = 7h BR (todo dia)
 *   }]
 * }
 *
 * Seguranca: Requer header x-cron-secret com CRON_SECRET do .env
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchLastWeek, searchLastMonth, DOUSection } from '@/lib/dou-api';
import { DOUClassifier } from '@/lib/dou-classifier';
import { scrapeContent } from '@/lib/dou-scraper';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { normalizeScrapedText } from '@/lib/legislative-scrapers/normalize';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutos (maximo para Vercel Pro)

// Limite de docs para enriquecer com scraper por execucao (evitar timeout)
const MAX_SCRAPE_PER_RUN = 10;

// Limite de caracteres do fullContent no staging (50k ~ suficiente para preview/classificacao)
const MAX_FULL_CONTENT_CHARS = 50_000;

// Dias para limpeza
const REJECTED_CLEANUP_DAYS = 30;
const IMPORTED_CLEANUP_DAYS = 90;

/**
 * GET /api/cron/import-dou
 *
 * Busca e classifica documentos DOU, salvando no staging para validacao manual
 */
export async function GET(request: NextRequest) {
  console.log('[Cron DOU Staging] Iniciando importacao para staging...');

  try {
    // Validar secret do cron (seguranca)
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    // Parametros da query string com validacao
    const { searchParams } = new URL(request.url);

    // Validar periodo (allow-list)
    const ALLOWED_PERIODS = ['week', 'month'] as const;
    const periodParam = searchParams.get('period') || 'week';

    if (!ALLOWED_PERIODS.includes(periodParam as typeof ALLOWED_PERIODS[number])) {
      console.error(`[Cron DOU Staging] Periodo invalido: ${periodParam}`);
      return NextResponse.json(
        { error: `Periodo invalido. Valores permitidos: ${ALLOWED_PERIODS.join(', ')}` },
        { status: 400 }
      );
    }
    const period = periodParam as typeof ALLOWED_PERIODS[number];

    // Validar e limitar maxResults (protecao contra DoS)
    const MAX_ALLOWED_RESULTS = 500;
    const limitParam = searchParams.get('limit') || '50';
    let maxResults = parseInt(limitParam, 10);

    if (isNaN(maxResults) || maxResults <= 0) {
      console.warn(`[Cron DOU Staging] Limite invalido '${limitParam}', usando padrao 50`);
      maxResults = 50;
    }

    maxResults = Math.min(maxResults, MAX_ALLOWED_RESULTS);

    console.log(`[Cron DOU Staging] Buscando publicacoes (periodo: ${period}, limite: ${maxResults})`);

    // PASSO 1: Buscar publicacoes na API oficial do DOU
    // Term focado em tipos de atos normativos + temas relevantes (Lei 14.133, terceirização, jornada).
    // Limita à Seção 1 (atos normativos do Executivo) e Seção 2 (atos do Judiciário/AGU/TCU)
    // para evitar a Seção 3 (editais, extratos, contratos) que gera ruído maciço.
    const searchTerm = '"instrução normativa" OR "orientação normativa" OR "decreto nº" OR "portaria normativa" OR "súmula" OR "acórdão" OR "lei nº" OR licitação OR contratação OR pregão OR terceirização OR jornada';
    const sections = [DOUSection.SECAO_1, DOUSection.SECAO_2];

    const results = period === 'month'
      ? await searchLastMonth(searchTerm, sections, maxResults)
      : await searchLastWeek(searchTerm, sections, maxResults);

    console.log(`[Cron DOU Staging] ${results.length} publicacoes encontradas`);

    if (results.length === 0) {
      // Ainda executar limpeza mesmo sem novos resultados
      const cleanup = await cleanupOldStaging();

      return NextResponse.json({
        success: true,
        message: 'Nenhuma publicacao encontrada',
        stats: {
          buscados: 0,
          autoAprovados: 0,
          pendentes: 0,
          autoRejeitados: 0,
          duplicados: 0,
          enriquecidos: 0,
          erros: 0,
          cleanup,
        }
      });
    }

    // PASSO 2: Classificar documentos com DOUClassifier
    console.log('[Cron DOU Staging] Classificando documentos...');
    const classifications = DOUClassifier.classifyBatch(results);

    // PASSO 2.5: Classificar com IA os documentos com baixa confiança (max 10 por run)
    const aiStats = await DOUClassifier.classifyBatchWithAI(results, classifications, undefined, 10);
    console.log(`[Cron DOU Staging] IA classificou ${aiStats.updated} docs (${aiStats.errors} erros)`);

    let autoAprovados = 0;
    let pendentes = 0;
    let autoRejeitados = 0;
    let duplicados = 0;
    let erros = 0;

    // IDs dos docs criados que precisam de enriquecimento
    const docsToEnrich: Array<{ id: string; url: string }> = [];

    // PASSO 3: Salvar no staging (DOUStagingDocument)
    console.log('[Cron DOU Staging] Salvando no staging...');

    for (const [result, classification] of classifications.entries()) {
      try {
        // Remove HTML do titulo
        const cleanTitle = result.title.replace(/<[^>]*>/g, '').trim();

        // Verificar duplicatas (por URL no staging)
        const existingDoc = await prisma.dOUStagingDocument.findFirst({
          where: { url: result.href }
        });

        if (existingDoc) {
          duplicados++;
          continue;
        }

        // Verificar se ja foi importado como Document (pelo sync-dou-atos-normativos)
        const existingDocument = await prisma.document.findFirst({
          where: { douUrl: result.href },
          select: { id: true },
        });

        if (existingDocument) {
          duplicados++;
          continue;
        }

        // Formatar data DD/MM/YYYY (DOU API retorna nesse formato)
        const publishDate = result.date || new Date().toLocaleDateString('pt-BR');

        // Criar documento no staging
        const stagingDoc = await prisma.dOUStagingDocument.create({
          data: {
            douId: result.href, // Usa URL como ID unico temporario
            title: cleanTitle,
            abstract: result.abstract || '',
            url: result.href,
            section: result.section || 'do3',
            publishDate: publishDate,
            hierarchyStr: result.hierarchyStr,

            // Classificacao automatica
            category: classification.category,
            approvalStatus: classification.status,
            confidence: classification.confidence,
            reasoning: JSON.stringify(classification.reasoning),
            isRelevant: classification.isRelevant,
            requiresReview: classification.requiresReview,

            // Controle
            imported: false,
          }
        });

        // Contar por status e coletar para enriquecimento
        if (classification.status === 'auto_approved') {
          autoAprovados++;
          docsToEnrich.push({ id: stagingDoc.id, url: result.href });
        } else if (classification.status === 'pending') {
          pendentes++;
          docsToEnrich.push({ id: stagingDoc.id, url: result.href });
        } else if (classification.status === 'auto_rejected') {
          autoRejeitados++;
        }

      } catch (error) {
        erros++;
        console.error(`[Cron DOU Staging] Erro ao salvar documento:`, error);
      }
    }

    // PASSO 4: Enriquecer docs com scraper cheerio (auto-aprovados + pendentes)
    let enriquecidos = 0;
    const toScrape = docsToEnrich.slice(0, MAX_SCRAPE_PER_RUN);

    if (toScrape.length > 0) {
      console.log(`[Cron DOU Staging] Enriquecendo ${toScrape.length} documentos com scraper...`);

      for (const doc of toScrape) {
        try {
          const enriched = await scrapeContent(doc.url);

          if (enriched && enriched.caracteres > 0) {
            // Normaliza ANTES de truncar para que cortes de boilerplate
            // (masthead DOU, "Compartilhe:" do gov.br, etc.) não consumam
            // o budget de MAX_FULL_CONTENT_CHARS.
            let content = normalizeScrapedText(enriched.conteudo);
            let truncated = false;
            if (content.length > MAX_FULL_CONTENT_CHARS) {
              content = content.substring(0, MAX_FULL_CONTENT_CHARS) + `\n\n[... truncado: ${enriched.caracteres.toLocaleString('pt-BR')} caracteres no total]`;
              truncated = true;
            }

            await prisma.dOUStagingDocument.update({
              where: { id: doc.id },
              data: {
                fullContent: content,
                edition: enriched.edicao,
                page: enriched.pagina,
                organ: enriched.orgao || undefined,
              },
            });
            enriquecidos++;

            if (truncated) {
              console.log(`[Cron DOU Staging] Conteudo truncado: ${enriched.caracteres.toLocaleString()} -> ${MAX_FULL_CONTENT_CHARS.toLocaleString()} chars`);
            }
          }

          // Rate limiting entre scrapes
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`[Cron DOU Staging] Erro ao enriquecer ${doc.id}:`, error);
        }
      }

      console.log(`[Cron DOU Staging] ${enriquecidos}/${toScrape.length} documentos enriquecidos`);
    }

    // PASSO 5: Limpeza automatica de staging antigo
    const cleanup = await cleanupOldStaging();

    console.log('[Cron DOU Staging] Importacao para staging concluida!');
    console.log(`[Cron DOU Staging] Auto-aprovados: ${autoAprovados}, Pendentes: ${pendentes}, Rejeitados: ${autoRejeitados}, Enriquecidos: ${enriquecidos}`);

    // Retornar estatisticas
    return NextResponse.json({
      success: true,
      message: `Staging populado: ${autoAprovados} auto-aprovados, ${pendentes} pendentes, ${enriquecidos} enriquecidos`,
      stats: {
        buscados: results.length,
        autoAprovados,
        pendentes,
        autoRejeitados,
        duplicados,
        enriquecidos,
        erros,
        cleanup,
        aiClassified: aiStats.updated,
        aiErrors: aiStats.errors,
      },
    });

  } catch (error) {
    console.error('[Cron DOU Staging] Erro fatal:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

/**
 * Limpa registros antigos do staging para evitar acumulo
 * - Auto-rejeitados com mais de 30 dias
 * - Importados com mais de 90 dias
 */
async function cleanupOldStaging(): Promise<{ rejectedDeleted: number; importedDeleted: number }> {
  let rejectedDeleted = 0;
  let importedDeleted = 0;

  try {
    const now = new Date();

    // Limpar auto-rejeitados com mais de 30 dias
    const rejectedCutoff = new Date(now);
    rejectedCutoff.setDate(rejectedCutoff.getDate() - REJECTED_CLEANUP_DAYS);

    const rejectedResult = await prisma.dOUStagingDocument.deleteMany({
      where: {
        approvalStatus: 'auto_rejected',
        createdAt: { lt: rejectedCutoff },
      },
    });
    rejectedDeleted = rejectedResult.count;

    // Limpar importados com mais de 90 dias
    const importedCutoff = new Date(now);
    importedCutoff.setDate(importedCutoff.getDate() - IMPORTED_CLEANUP_DAYS);

    const importedResult = await prisma.dOUStagingDocument.deleteMany({
      where: {
        imported: true,
        createdAt: { lt: importedCutoff },
      },
    });
    importedDeleted = importedResult.count;

    if (rejectedDeleted > 0 || importedDeleted > 0) {
      console.log(`[Cron DOU Staging] Limpeza: ${rejectedDeleted} rejeitados (>${REJECTED_CLEANUP_DAYS}d) + ${importedDeleted} importados (>${IMPORTED_CLEANUP_DAYS}d) removidos`);
    }
  } catch (error) {
    console.error('[Cron DOU Staging] Erro na limpeza:', error);
  }

  return { rejectedDeleted, importedDeleted };
}
