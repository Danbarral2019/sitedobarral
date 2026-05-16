import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('compute-streaks', async () => {
      const { prisma } = await import('@/lib/prisma');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const expiredStreaks = await prisma.userStreak.findMany({
        where: {
          currentStreak: { gt: 0 },
          OR: [
            { lastActivityDate: { lt: yesterdayStr } },
            { lastActivityDate: null },
          ],
        },
        select: { id: true },
      });

      if (expiredStreaks.length === 0) {
        responseBody = { message: 'No streaks to reset', reset: 0 };
        return { itemsFound: 0 };
      }

      const result = await prisma.userStreak.updateMany({
        where: { id: { in: expiredStreaks.map(s => s.id) } },
        data: { currentStreak: 0 },
      });

      console.log(`[compute-streaks] Reset ${result.count} expired streaks`);
      responseBody = { message: `Reset ${result.count} expired streaks`, reset: result.count };
      return { itemsFound: expiredStreaks.length, itemsNew: result.count };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao computar streaks', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
