import { NextRequest, NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';

export const PATCH = withUserApi<{ courseId: string }>(async (
  request: NextRequest,
  ctx
) => {
  const { courseId } = ctx.params;

  const body = await request.json();
  const showOnLeaderboard = Boolean(body.showOnLeaderboard);

  const streak = await prisma.userStreak.upsert({
    where: { userId_courseId: { userId: ctx.user.userId, courseId } },
    create: { userId: ctx.user.userId, courseId, showOnLeaderboard },
    update: { showOnLeaderboard },
  });

  return NextResponse.json({ showOnLeaderboard: streak.showOnLeaderboard });
});
