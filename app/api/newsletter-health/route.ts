import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/newsletter-health
 *
 * Endpoint público read-only que retorna o status do envio da newsletter
 * mensal. Usado por agente remoto agendado pra alertar quando o disparo
 * do dia 1 falhou (sem precisar de DB credentials no ambiente cloud).
 *
 * Não expõe PII nem segredos — apenas counts e metadados do último send.
 */
export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [lastMonthly, dispatchesThisMonth, activeSubscribers] = await Promise.all([
      prisma.newsletterSend.findFirst({
        where: { type: 'monthly' },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true, subject: true, totalSent: true, totalFailed: true },
      }),
      prisma.newsletterSend.count({
        where: { type: 'monthly', sentAt: { gte: startOfMonth } },
      }),
      prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    ]);

    const dispatchedThisMonth = dispatchesThisMonth > 0;
    const lastDispatchInProcessing = lastMonthly?.subject?.startsWith('[em processamento]') ?? false;

    return NextResponse.json({
      checkedAt: now.toISOString(),
      currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      monthly: {
        dispatchedThisMonth,
        dispatchesThisMonthCount: dispatchesThisMonth,
        lastSentAt: lastMonthly?.sentAt?.toISOString() ?? null,
        lastSubject: lastMonthly?.subject ?? null,
        lastTotalSent: lastMonthly?.totalSent ?? 0,
        lastTotalFailed: lastMonthly?.totalFailed ?? 0,
        lastDispatchInProcessing,
      },
      subscribers: {
        active: activeSubscribers,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
