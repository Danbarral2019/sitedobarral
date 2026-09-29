import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeUrl, canScrapeUrl } from '@/lib/legislative-scrapers';
import { hasHashChanged } from '@/lib/legislative-scrapers/change-detector';
import { scrapeAndIndexAct } from '@/lib/legislative-scrapers/scrape-and-index';
import { verifyCronAuth } from '@/lib/cron-auth';
import { detectAndSaveRelationsHybrid } from '@/lib/legislative-acts/relations';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

/**
 * GET /api/cron/check-legislative-updates
 *
 * Cron job para verificar automaticamente atualizações em atos normativos.
 * - Roda todo dia (vercel.json) e confere até LOTE atos não checados há 7+
 *   dias, os mais antigos primeiro, dentro de PRAZO_MS. Com ~280 atos, o
 *   acervo inteiro é conferido em cerca de uma semana. Antes eram 10 atos por
 *   semana: cada ato era revisto a cada seis meses, e alteração de IN ou
 *   portaria demorava meses para chegar ao site.
 * - Delay de 2s entre requisições para evitar rate limiting
 */
export const maxDuration = 300;

/** Atos por execução; o prazo abaixo interrompe antes, se o lote demorar. */
const LOTE = 40;
/** Margem de 60 s sob o maxDuration para a segunda passagem e a resposta. */
const PRAZO_MS = 240_000;

export async function GET(request: NextRequest) {
  const inicio = Date.now();
  const dentroDoPrazo = () => Date.now() - inicio < PRAZO_MS;
  // Verificar autenticação via CRON_SECRET (fora do telemetry)
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('check-legislative-updates', async () => {
      console.log('[Cron Legislative] Iniciando verificação de atualizações...');

    // Buscar atos que não foram verificados há 7+ dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const actsToCheck = await prisma.legislativeAct.findMany({
      where: {
        officialUrl: { not: null },
        scrapeStatus: { not: 'manual' },
        OR: [
          { lastScrapedAt: null },
          { lastScrapedAt: { lt: sevenDaysAgo } },
        ],
      },
      select: {
        id: true,
        fullNumber: true,
        officialUrl: true,
        content: true,
        contentHash: true,
      },
      take: LOTE,
      orderBy: [
        { lastScrapedAt: 'asc' }, // Mais antigos primeiro
      ],
    });

    console.log(`[Cron Legislative] ${actsToCheck.length} atos para verificar`);

    const results: {
      id: string;
      fullNumber: string;
      status: 'success' | 'unchanged' | 'failed' | 'skipped';
      changed?: boolean;
      error?: string;
    }[] = [];

    for (const act of actsToCheck) {
      // Os que ficarem de fora seguem os mais antigos e entram na próxima execução.
      if (!dentroDoPrazo()) break;

      // Verificar se temos scraper para esta URL
      if (!act.officialUrl || !canScrapeUrl(act.officialUrl)) {
        // Registra a tentativa: sem isso o ato fica para sempre no topo da
        // fila (mais antigo primeiro) e ocupa uma vaga do lote a cada execução.
        await prisma.legislativeAct.update({
          where: { id: act.id },
          data: { lastScrapedAt: new Date(), scrapeError: 'URL sem scraper' },
        });
        results.push({
          id: act.id,
          fullNumber: act.fullNumber,
          status: 'skipped',
          error: 'URL não suportada',
        });
        continue;
      }

      console.log(`[Cron Legislative] Verificando: ${act.fullNumber}`);

      try {
        // Fazer scraping
        const result = await scrapeUrl(act.officialUrl);

        if (!result.success) {
          // Registrar falha
          await prisma.legislativeAct.update({
            where: { id: act.id },
            data: {
              lastScrapedAt: new Date(),
              scrapeStatus: 'failed',
              scrapeError: result.error,
            },
          });

          results.push({
            id: act.id,
            fullNumber: act.fullNumber,
            status: 'failed',
            error: result.error,
          });
        } else {
          // Verificar se houve mudança
          const changed = hasHashChanged(act.contentHash, result.hash!);

          // Atualizar registro
          await prisma.legislativeAct.update({
            where: { id: act.id },
            data: {
              lastScrapedAt: new Date(),
              scrapeStatus: changed ? 'success' : 'unchanged',
              scrapeError: null,
              ...(changed && {
                content: result.content,
                contentHash: result.hash,
                changeDetectedAt: new Date(),
                // Texto novo, índice velho: o cron process-index-jobs refaz.
                embeddingStatus: 'pending',
              }),
            },
          });

          results.push({
            id: act.id,
            fullNumber: act.fullNumber,
            status: changed ? 'success' : 'unchanged',
            changed,
          });

          // Re-detectar relações quando o conteúdo mudou (ex: portal oficial
          // consolidou alteração de norma posterior). Heurística + IA opt-in.
          if (changed && result.content) {
            const updated = await prisma.legislativeAct.findUnique({
              where: { id: act.id },
              select: { ementa: true },
            });
            if (updated) {
              const r = await detectAndSaveRelationsHybrid(act.id, updated.ementa, result.content);
              if (r.heuristicCount > 0 || r.aiAdded > 0) {
                const aiDesc = r.aiAdded > 0 ? ` [+${r.aiAdded} IA]` : '';
                console.log(`[Cron Legislative] ${act.fullNumber}: ${r.created} relações novas, ${r.skipped} puladas${aiDesc}`);
              }
            }
          }
        }
      } catch (error) {
        apiLogger.error({ err: error }, `[Cron Legislative] Erro em ${act.fullNumber}:`);
        results.push({
          id: act.id,
          fullNumber: act.fullNumber,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }

      // Delay de 2s entre requisições para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Segunda passagem: preencher backlog de atos COM officialUrl mas SEM content
    const backlogActs = await prisma.legislativeAct.findMany({
      where: {
        officialUrl: { not: null },
        content: null,
        // Excluir atos já processados nesta execução
        id: { notIn: actsToCheck.map(a => a.id) },
      },
      select: { id: true, fullNumber: true },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    const backlogResults: { id: string; fullNumber: string; scraped: boolean; indexed: boolean; error?: string }[] = [];

    if (backlogActs.length > 0) {
      console.log(`[Cron Legislative] Preenchendo backlog: ${backlogActs.length} atos sem conteúdo`);

      for (const act of backlogActs) {
        if (!dentroDoPrazo()) break;
        try {
          const res = await scrapeAndIndexAct(act.id);
          backlogResults.push({ id: act.id, fullNumber: act.fullNumber, ...res });
        } catch (error) {
          backlogResults.push({
            id: act.id,
            fullNumber: act.fullNumber,
            scraped: false,
            indexed: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Estatísticas
    const stats = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      unchanged: results.filter(r => r.status === 'unchanged').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      changed: results.filter(r => r.changed).length,
      backlog: {
        total: backlogResults.length,
        scraped: backlogResults.filter(r => r.scraped).length,
        indexed: backlogResults.filter(r => r.indexed).length,
      },
    };

      console.log('[Cron Legislative] Concluído:', stats);

      responseBody = {
        success: true,
        timestamp: new Date().toISOString(),
        stats,
        results,
        backlogResults,
      };
      return {
        itemsFound: stats.total,
        itemsNew: stats.changed,
        itemsError: stats.failed,
        metadata: { backlogResults: backlogResults.length, pendentesNoLote: actsToCheck.length - results.length },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Erro ao processar verificação',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/check-legislative-updates
 *
 * Endpoint alternativo para trigger manual ou via webhook.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
