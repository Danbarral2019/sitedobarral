import { NextRequest, NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors/api-error';

/**
 * GET: Retorna as tentativas anteriores do aluno para o quiz desta lição
 */
export const GET = withUserApi<{ lessonId: string }>(async (
  _request: NextRequest,
  ctx
) => {
  const { lessonId } = ctx.params;

  const quiz = await prisma.quiz.findUnique({
    where: { lessonId },
  });

  if (!quiz) {
    throw new NotFoundError('Quiz');
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: {
      quizId: quiz.id,
      userId: ctx.user.userId,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      score: true,
      totalPoints: true,
      maxPoints: true,
      passed: true,
      startedAt: true,
      completedAt: true,
      timeSpentSeconds: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    attempts,
    quizId: quiz.id,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
  });
});
