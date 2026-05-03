import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dou-clipping-health
 *
 * Endpoint público read-only com métricas do Clipping DOU v2. Usado por
 * routine remota agendada pra alertar se o cron falhou ou o classificador
 * está descalibrado. Não expõe PII nem segredos.
 *
 * Espelha pattern de /api/conuni-health e /api/newsletter-health.
 */
export async function GET() {
  try {
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [lastCron, queuePending, queueAmbiguous, classified24h, decisions30d] = await Promise.all([
      prisma.dOUStagingDocument.findFirst({
        where: { source: 'cron', editorialClassifiedAt: { not: null } },
        orderBy: { editorialClassifiedAt: 'desc' },
        select: { editorialClassifiedAt: true },
      }),
      prisma.dOUStagingDocument.count({
        where: { editorialScore: { not: null }, finalDecision: null, imported: false },
      }),
      prisma.dOUStagingDocument.count({
        where: { editorialAmbiguous: true, finalDecision: null, imported: false },
      }),
      prisma.dOUStagingDocument.count({
        where: { editorialClassifiedAt: { gte: dayAgo } },
      }),
      prisma.dOUStagingDocument.findMany({
        where: {
          editorialScore: { not: null },
          reviewedAt: { gte: monthAgo },
          finalDecision: { in: ['approved', 'rejected'] },
        },
        select: { finalDecision: true },
      }),
    ]);

    const lastCronAt = lastCron?.editorialClassifiedAt ?? null;
    const hoursSinceLastCron = lastCronAt
      ? Math.floor((now - new Date(lastCronAt).getTime()) / 3_600_000)
      : null;

    const approved30d = decisions30d.filter((d) => d.finalDecision === 'approved').length;
    const rejected30d = decisions30d.filter((d) => d.finalDecision === 'rejected').length;
    const total30d = approved30d + rejected30d;
    const approvalRate30d = total30d > 0 ? Math.round((approved30d / total30d) * 100) / 100 : null;

    // Status agregado
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (!lastCronAt || (hoursSinceLastCron !== null && hoursSinceLastCron > 30)) status = 'down';
    else if (
      (approvalRate30d !== null && approvalRate30d < 0.4) ||
      (queuePending === 0 && classified24h === 0)
    ) {
      status = 'degraded';
    }

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      status,
      lastCronAt,
      hoursSinceLastCron,
      queuePending,
      queueAmbiguous,
      classifiedLast24h: classified24h,
      approvalRate30d,
      approved30d,
      rejected30d,
      // Janela maior pra contexto
      classifiedLast7d: await prisma.dOUStagingDocument.count({
        where: { editorialClassifiedAt: { gte: weekAgo } },
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'down', error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 },
    );
  }
}
