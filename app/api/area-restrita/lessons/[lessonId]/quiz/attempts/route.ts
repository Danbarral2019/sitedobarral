import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';

/**
 * GET: Retorna as tentativas anteriores do aluno para o quiz desta lição
 */
export const GET = withAuth(async (
  request: NextRequest,
  context?: Record<string, unknown>
) => {
  try {
    const user = context?.user as { userId: string };
    const { lessonId } = await (context as { params: Promise<{ lessonId: string }> }).params;

    const quiz = await prisma.quiz.findUnique({
      where: { lessonId },
    });

    if (!quiz) {
      throw new NotFoundError('Quiz');
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId: quiz.id,
        userId: user.userId,
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
  } catch (error) {
    return handleApiError(error);
  }
});
