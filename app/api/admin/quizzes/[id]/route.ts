import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { UpdateQuizSchema } from '@/lib/validation-schemas';

/**
 * GET: Busca um quiz por ID com perguntas
 */
export const GET = withAdminApi<{ id: string }>(async (_request, { params }) => {
  const { id } = params;

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      lesson: { select: { id: true, title: true, slug: true, moduleId: true } },
      questions: { orderBy: { displayOrder: 'asc' } },
      _count: { select: { attempts: true } },
    },
  });

  if (!quiz) {
    throw new NotFoundError('Quiz');
  }

  // Parse JSON options de cada pergunta
  const questionsWithParsed = quiz.questions.map(q => ({
    ...q,
    options: JSON.parse(q.options),
  }));

  return NextResponse.json({ quiz: { ...quiz, questions: questionsWithParsed } });
});

/**
 * PUT: Atualiza um quiz
 */
export const PUT = withAdminApi<{ id: string }>(async (request, { params }) => {
  const { id } = params;
  const body = await request.json();
  const data = UpdateQuizSchema.parse(body);

  const existing = await prisma.quiz.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Quiz');
  }

  const quiz = await prisma.quiz.update({
    where: { id },
    data,
  });

  apiLogger.info({ quizId: id }, 'Quiz updated');
  return NextResponse.json({ quiz });
});

/**
 * DELETE: Remove um quiz (cascade nas perguntas e tentativas)
 */
export const DELETE = withAdminApi<{ id: string }>(async (_request, { params }) => {
  const { id } = params;

  const existing = await prisma.quiz.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Quiz');
  }

  await prisma.quiz.delete({ where: { id } });

  apiLogger.info({ quizId: id }, 'Quiz deleted');
  return NextResponse.json({ success: true });
});
