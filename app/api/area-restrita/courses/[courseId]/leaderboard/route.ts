import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { BADGE_TYPES } from '@/lib/gamification';

export const GET = withAuth(async (
  request: NextRequest,
  context?: Record<string, unknown>
) => {
  const user = context?.user as { userId: string };
  const { courseId } = await (context as { params: Promise<{ courseId: string }> }).params;

  // Top 20 by XP (opt-in only)
  const streaks = await prisma.userStreak.findMany({
    where: { courseId, showOnLeaderboard: true },
    orderBy: { totalXp: 'desc' },
    take: 20,
  });

  const userIds = streaks.map(s => s.userId);

  // Batch lookup users + badges
  const [users, badges] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    }),
    prisma.badge.findMany({
      where: { userId: { in: userIds }, courseId },
    }),
  ]);

  const userMap = new Map(users.map(u => [u.id, u.name]));
  const badgeCountMap = new Map<string, number>();
  for (const b of badges) {
    badgeCountMap.set(b.userId, (badgeCountMap.get(b.userId) || 0) + 1);
  }

  const leaderboard = streaks.map((s, idx) => ({
    position: idx + 1,
    userId: s.userId,
    name: userMap.get(s.userId) || 'Aluno',
    initial: (userMap.get(s.userId) || 'A').charAt(0).toUpperCase(),
    xp: s.totalXp,
    streak: s.currentStreak,
    badgeCount: badgeCountMap.get(s.userId) || 0,
    isCurrentUser: s.userId === user.userId,
  }));

  // Find current user's position if not in top 20
  let currentUserPosition: number | null = null;
  const isInTop = leaderboard.some(l => l.isCurrentUser);
  if (!isInTop) {
    const userStreak = await prisma.userStreak.findUnique({
      where: { userId_courseId: { userId: user.userId, courseId } },
    });
    if (userStreak) {
      const ahead = await prisma.userStreak.count({
        where: { courseId, showOnLeaderboard: true, totalXp: { gt: userStreak.totalXp } },
      });
      currentUserPosition = ahead + 1;
    }
  }

  return NextResponse.json({
    leaderboard,
    currentUserPosition,
    badgeTypes: BADGE_TYPES,
  });
});
