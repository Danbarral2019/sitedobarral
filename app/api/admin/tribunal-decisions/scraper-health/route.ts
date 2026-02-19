import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';

/**
 * GET /api/admin/tribunal-decisions/scraper-health
 * Status de saúde dos scrapers — último run e falhas consecutivas
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid || authResult.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar os últimos logs de cada scraper
    const allLogs = await prisma.scraperHealthLog.findMany({
      orderBy: { runAt: 'desc' },
      take: 100, // últimos 100 logs para cobrir todos os scrapers
    });

    // Agrupar por scraperCode
    const scraperMap = new Map<string, typeof allLogs>();
    for (const log of allLogs) {
      if (!scraperMap.has(log.scraperCode)) {
        scraperMap.set(log.scraperCode, []);
      }
      scraperMap.get(log.scraperCode)!.push(log);
    }

    const scrapers = Array.from(scraperMap.entries()).map(([code, logs]) => {
      const lastRun = logs[0];

      // Contar falhas consecutivas (do mais recente para o mais antigo)
      let consecutiveFailures = 0;
      for (const log of logs) {
        if (log.status === 'failure') {
          consecutiveFailures++;
        } else {
          break;
        }
      }

      return {
        scraperCode: code,
        lastRun: {
          status: lastRun.status,
          itemsFound: lastRun.itemsFound,
          itemsNew: lastRun.itemsNew,
          itemsError: lastRun.itemsError,
          duration: lastRun.duration,
          errorMessage: lastRun.errorMessage,
          runAt: lastRun.runAt,
        },
        consecutiveFailures,
        isHealthy: consecutiveFailures < 3,
        totalRuns: logs.length,
      };
    });

    return NextResponse.json({ scrapers });
  } catch (error) {
    return handleApiError(error);
  }
}
