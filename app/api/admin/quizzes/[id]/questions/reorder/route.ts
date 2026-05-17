import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { ReorderSchema } from '@/lib/validation-schemas';
import { withAdminApi } from '@/lib/api/handler';

/**
 * PUT: Reordena as perguntas de um quiz
 */
export const PUT = withAdminApi<{ id: string }>(async (request, ctx) => {
  const { id: quizId } = ctx.params;
  const body = await request.json();
  const { items } = ReorderSchema.parse(body);

  // Verificar se o quiz existe
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) {
    throw new NotFoundError('Quiz');
  }

  // Atualizar displayOrder de cada pergunta
  await prisma.$transaction(
    items.map(item =>
      prisma.quizQuestion.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      })
    )
  );

  apiLogger.info({ quizId, count: items.length }, 'Quiz questions reordered');
  return NextResponse.json({ success: true });
});
