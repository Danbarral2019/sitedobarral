import { NextRequest, NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { AuthorizationError } from '@/lib/errors/api-error';

export const PATCH = withUserApi<{ courseId: string }>(async (
  request: NextRequest,
  ctx
) => {
  const { courseId } = ctx.params;

  // Só aluno com matrícula válida no curso (admin passa direto)
  if (ctx.user.role !== 'admin') {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: ctx.user.userId,
        courseId,
        OR: [
          { isLifetime: true },
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { id: true },
    });
    if (!enrollment) throw new AuthorizationError('Acesso expirado ou inexistente para este curso.');
  }

  const body = await request.json();
  const showOnLeaderboard = Boolean(body.showOnLeaderboard);

  const streak = await prisma.userStreak.upsert({
    where: { userId_courseId: { userId: ctx.user.userId, courseId } },
    create: { userId: ctx.user.userId, courseId, showOnLeaderboard },
    update: { showOnLeaderboard },
  });

  return NextResponse.json({ showOnLeaderboard: streak.showOnLeaderboard });
});
