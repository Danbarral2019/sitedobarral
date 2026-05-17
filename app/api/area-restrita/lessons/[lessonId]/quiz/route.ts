import { NextRequest, NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors/api-error';

/**
 * GET: Retorna o quiz de uma lição (perguntas SEM isCorrect para o aluno)
 */
export const GET = withUserApi<{ lessonId: string }>(async (
  _request: NextRequest,
  ctx
) => {
  const { lessonId } = ctx.params;

  const quiz = await prisma.quiz.findUnique({
    where: { lessonId },
    include: {
      questions: {
        orderBy: { displayOrder: 'asc' },
      },
      _count: { select: { attempts: true } },
    },
  });

  if (!quiz || !quiz.isPublished) {
    throw new NotFoundError('Quiz');
  }

  // Contar tentativas do usuário
  const userAttempts = await prisma.quizAttempt.count({
    where: { quizId: quiz.id, userId: ctx.user.userId },
  });

  // Verificar se atingiu o limite de tentativas
  const attemptsRemaining = quiz.maxAttempts
    ? Math.max(0, quiz.maxAttempts - userAttempts)
    : null; // null = ilimitado

  // Remover isCorrect das opções para o aluno
  let questions = quiz.questions.map(q => {
    const options = JSON.parse(q.options) as { id: string; text: string; isCorrect: boolean }[];
    return {
      id: q.id,
      type: q.type,
      text: q.text,
      options: options.map(o => ({ id: o.id, text: o.text })),
      points: q.points,
      displayOrder: q.displayOrder,
    };
  });

  // Shuffle se configurado
  if (quiz.shuffleQuestions) {
    questions = questions.sort(() => Math.random() - 0.5);
  }

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      passingScore: quiz.passingScore,
      timeLimitMinutes: quiz.timeLimitMinutes,
      maxAttempts: quiz.maxAttempts,
      questionCount: questions.length,
      totalPoints: quiz.questions.reduce((sum, q) => sum + q.points, 0),
    },
    questions,
    userAttempts,
    attemptsRemaining,
  });
});
