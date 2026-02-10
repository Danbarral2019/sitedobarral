import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { UpdateQuizQuestionSchema } from '@/lib/validation-schemas';
import { verifyAdmin } from '@/lib/api-middleware';

/**
 * PUT: Atualiza uma pergunta do quiz
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id: quizId, questionId } = await params;
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
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE: Remove uma pergunta do quiz
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id: quizId, questionId } = await params;

    const existing = await prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId },
    });
    if (!existing) {
      throw new NotFoundError('Pergunta');
    }

    await prisma.quizQuestion.delete({ where: { id: questionId } });

    apiLogger.info({ questionId, quizId }, 'Quiz question deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
