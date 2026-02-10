import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prisma } = await import('@/lib/prisma');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Find all streaks that have a current streak > 0 but lastActivityDate < yesterday
  // (they missed at least one day)
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
    return NextResponse.json({ message: 'No streaks to reset', reset: 0 });
  }

  // Batch reset
  const result = await prisma.userStreak.updateMany({
    where: {
      id: { in: expiredStreaks.map(s => s.id) },
    },
    data: { currentStreak: 0 },
  });

  console.log(`[compute-streaks] Reset ${result.count} expired streaks`);

  return NextResponse.json({
    message: `Reset ${result.count} expired streaks`,
    reset: result.count,
  });
}
