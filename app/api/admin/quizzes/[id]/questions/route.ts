import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { CreateQuizQuestionSchema } from '@/lib/validation-schemas';
import { withAdminApi } from '@/lib/api/handler';

/**
 * POST: Adiciona uma pergunta ao quiz
 */
export const POST = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id: quizId } = ctx.params;
  const body = await request.json();
  const data = CreateQuizQuestionSchema.parse(body);

  // Verificar se o quiz existe
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    throw new NotFoundError('Quiz');
  }

  // Auto-set displayOrder
  let displayOrder = data.displayOrder;
  if (displayOrder === undefined) {
    const maxOrder = await prisma.quizQuestion.aggregate({
      where: { quizId },
      _max: { displayOrder: true },
    });
    displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;
  }

  const question = await prisma.quizQuestion.create({
    data: {
      quizId,
      type: data.type,
      text: data.text,
      options: JSON.stringify(data.options),
      explanation: data.explanation,
      displayOrder,
      points: data.points ?? 1,
    },
  });

  apiLogger.info({ questionId: question.id, quizId }, 'Quiz question created');
  return NextResponse.json({
    question: { ...question, options: data.options },
  }, { status: 201 });
});
