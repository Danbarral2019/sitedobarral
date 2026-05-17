import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { UpdateQuizQuestionSchema } from '@/lib/validation-schemas';

/**
 * PUT: Atualiza uma pergunta do quiz
 */
export const PUT = withAdminApi<{ id: string; questionId: string }>(async (request, { params }) => {
  const { id: quizId, questionId } = params;
  const body = await request.json();
  const data = UpdateQuizQuestionSchema.parse(body);

  const existing = await prisma.quizQuestion.findFirst({
    where: { id: questionId, quizId },
  });
  if (!existing) {
    throw new NotFoundError('Pergunta');
  }

  const updateData: Record<string, unknown> = { ...data };
  if (data.options) {
    updateData.options = JSON.stringify(data.options);
  }

  const question = await prisma.quizQuestion.update({
    where: { id: questionId },
    data: updateData,
  });

  apiLogger.info({ questionId, quizId }, 'Quiz question updated');
  return NextResponse.json({
    question: { ...question, options: JSON.parse(question.options) },
  });
});

/**
 * DELETE: Remove uma pergunta do quiz
 */
export const DELETE = withAdminApi<{ id: string; questionId: string }>(async (_request, { params }) => {
  const { id: quizId, questionId } = params;

  const existing = await prisma.quizQuestion.findFirst({
    where: { id: questionId, quizId },
  });
  if (!existing) {
    throw new NotFoundError('Pergunta');
  }

  await prisma.quizQuestion.delete({ where: { id: questionId } });

  apiLogger.info({ questionId, quizId }, 'Quiz question deleted');
  return NextResponse.json({ success: true });
});
