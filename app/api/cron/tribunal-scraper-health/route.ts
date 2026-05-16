import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/cron/tribunal-scraper-health
 * Cron diário: verifica saúde dos scrapers de tribunais
 * Schedule: "0 0 * * *" (meia-noite UTC)
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  console.log('[Tribunal Scraper Health] Verificando saúde dos scrapers...');

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('tribunal-scraper-health', async () => {
      // Buscar últimos logs agrupados por scraper
      const allLogs = await prisma.scraperHealthLog.findMany({
      orderBy: { runAt: 'desc' },
      take: 100,
    });

    const scraperMap = new Map<string, typeof allLogs>();
    for (const log of allLogs) {
      if (!scraperMap.has(log.scraperCode)) {
        scraperMap.set(log.scraperCode, []);
      }
      scraperMap.get(log.scraperCode)!.push(log);
    }

    const warnings: string[] = [];
    const scrapers = Array.from(scraperMap.entries()).map(([code, logs]) => {
      // Contar falhas consecutivas recentes
      let consecutiveFailures = 0;
      for (const log of logs) {
        if (log.status === 'failure') {
          consecutiveFailures++;
        } else {
          break;
        }
      }

      const isHealthy = consecutiveFailures < 3;
      if (!isHealthy) {
        warnings.push(
          `Scraper "${code}" com ${consecutiveFailures} falhas consecutivas. Último erro: ${logs[0]?.errorMessage || 'desconhecido'}`
        );
      }

      return {
        scraperCode: code,
        isHealthy,
        consecutiveFailures,
        lastRunAt: logs[0]?.runAt || null,
        lastStatus: logs[0]?.status || null,
      };
    });

    if (warnings.length > 0) {
      console.warn('[Tribunal Scraper Health] WARNINGS:', warnings);
    }

      console.log(`[Tribunal Scraper Health] ${scrapers.length} scrapers verificados, ${warnings.length} warnings`);

      responseBody = {
        success: true,
        scrapers,
        warnings,
        hasWarnings: warnings.length > 0,
      };

      return {
        itemsFound: scrapers.length,
        itemsError: warnings.length,
        metadata: { warnings },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
