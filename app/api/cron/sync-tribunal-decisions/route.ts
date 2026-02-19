import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/cron/sync-tribunal-decisions
 * Cron semanal: executa todos os scrapers de tribunais
 * Schedule: "0 7 * * 1" (segunda-feira 7h UTC = 4h BR)
 */
export async function GET(request: NextRequest) {
  console.log('[Sync Tribunal Decisions] Iniciando sincronização...');

  try {
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    // Import dinâmico dos scrapers (evita bundling em todas as rotas)
    const { getAllScrapers } = await import('@/lib/tribunal-scrapers');

    const scrapers = getAllScrapers();
    const results = [];

    for (const scraper of scrapers) {
      const startTime = Date.now();
      try {
        console.log(`[Sync Tribunal Decisions] Executando scraper: ${scraper.code}`);
        const result = await scraper.scrape({ maxItems: 50 });
        const duration = Date.now() - startTime;

        // Log health
        await prisma.scraperHealthLog.create({
          data: {
            scraperCode: scraper.code,
            status: result.itemsError > 0 ? 'partial_failure' : 'success',
            itemsFound: result.itemsFound,
            itemsNew: result.itemsNew,
            itemsError: result.itemsError,
            duration,
          },
        });

        console.log(
          `[Sync Tribunal Decisions] ${scraper.code}: found=${result.itemsFound} new=${result.itemsNew} errors=${result.itemsError} (${duration}ms)`
        );
        results.push({ ...result, scraperCode: scraper.code, duration });
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error(`[Sync Tribunal Decisions] ${scraper.code} falhou:`, errorMessage);

        await prisma.scraperHealthLog.create({
          data: {
            scraperCode: scraper.code,
            status: 'failure',
            duration,
            errorMessage,
          },
        });

        results.push({ scraperCode: scraper.code, error: errorMessage, duration });
      }
    }

    const totalNew = results.reduce((sum, r) => sum + (('itemsNew' in r ? r.itemsNew : 0) || 0), 0);
    const totalErrors = results.reduce((sum, r) => sum + (('itemsError' in r ? r.itemsError : 0) || 0), 0);

    // Identificar highlights editoriais nas novas decisões
    let highlightsCreated = 0;
    if (totalNew > 0) {
      try {
        const startTime = new Date(Date.now() - 600000); // 10 min atrás (margem de segurança)
        const newDecisions = await prisma.tribunalDecision.findMany({
          where: {
            createdAt: { gte: startTime },
            approvalStatus: 'auto_approved',
            highlights: { none: {} },
          },
          select: { id: true },
        });

        if (newDecisions.length > 0) {
          const { identifyAndAlertTribunalHighlights } = await import('@/lib/tribunal-highlight-analyzer');
          highlightsCreated = await identifyAndAlertTribunalHighlights(newDecisions.map(d => d.id));
          console.log(`[Sync Tribunal Decisions] ${highlightsCreated} highlights editoriais criados`);
        }
      } catch (err) {
        console.error('[Sync Tribunal Decisions] Erro ao analisar highlights:', err instanceof Error ? err.message : err);
      }
    }

    const summary = {
      totalScrapers: scrapers.length,
      totalNew,
      totalErrors,
      highlightsCreated,
    };

    console.log('[Sync Tribunal Decisions] Concluído:', JSON.stringify(summary));

    return NextResponse.json({ success: true, summary, results });
  } catch (error) {
    console.error('[Sync Tribunal Decisions] Erro fatal:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
