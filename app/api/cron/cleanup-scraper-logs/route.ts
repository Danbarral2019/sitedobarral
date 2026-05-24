import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Cleanup retention de ScraperHealthLog: deleta registros com runAt > 90 dias.
 *
 * `ScraperHealthLog` é alimentada por `withCronTelemetry` em todos os crons
 * instrumentados — cresce indefinidamente sem este job. Em ~6 meses pode
 * passar de 100k linhas; consultas `take: 100` viram O(n) sem o cleanup.
 *
 * Detectado em auditoria pós-reconciliação 2026-05-24.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
const RETENTION_DAYS = 90;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('cleanup-scraper-logs', async () => {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const result = await prisma.scraperHealthLog.deleteMany({
        where: { runAt: { lt: cutoff } },
      });

      apiLogger.info(
        { deleted: result.count, cutoff: cutoff.toISOString(), retentionDays: RETENTION_DAYS },
        'cleanup-scraper-logs: deleted old entries'
      );

      responseBody = {
        ok: true,
        deleted: result.count,
        cutoff: cutoff.toISOString(),
        retentionDays: RETENTION_DAYS,
      };
      return {
        itemsFound: result.count,
        itemsNew: 0,
        metadata: { retentionDays: RETENTION_DAYS },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
