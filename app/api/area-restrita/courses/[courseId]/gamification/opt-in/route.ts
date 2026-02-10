import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const PATCH = withAuth(async (
  request: NextRequest,
  context?: Record<string, unknown>
) => {
  const user = context?.user as { userId: string };
  const { courseId } = await (context as { params: Promise<{ courseId: string }> }).params;

  const body = await request.json();
  const showOnLeaderboard = Boolean(body.showOnLeaderboard);

  const streak = await prisma.userStreak.upsert({
    where: { userId_courseId: { userId: user.userId, courseId } },
    create: { userId: user.userId, courseId, showOnLeaderboard },
    update: { showOnLeaderboard },
  });

  return NextResponse.json({ showOnLeaderboard: streak.showOnLeaderboard });
});
