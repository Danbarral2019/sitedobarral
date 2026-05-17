import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { UpdateLessonSchema } from '@/lib/validation-schemas';

/**
 * GET: Busca uma lição por ID com relacionamentos
 */
export const GET = withAdminApi<{ id: string }>(async (_request, { params }) => {
  const { id } = params;

  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      module: true,
      documents: {
        include: { document: true },
        orderBy: { displayOrder: 'asc' },
      },
      videos: {
        orderBy: { displayOrder: 'asc' },
      },
      _count: {
        select: {
          progress: true,
          comments: true,
        },
      },
    },
  });

  if (!lesson) {
    throw new NotFoundError('Lição');
  }

  apiLogger.info({ lessonId: id }, 'Lesson fetched');
  return NextResponse.json({ lesson });
});

/**
 * PUT: Atualiza uma lição
 */
export const PUT = withAdminApi<{ id: string }>(async (request, { params }) => {
  const { id } = params;
  const body = await request.json();
  const data = UpdateLessonSchema.parse(body);

  const existing = await prisma.lesson.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Lição');
  }

  // Stringify arrays antes de salvar
  const updateData: Record<string, unknown> = { ...data };
  if (data.leiArticles !== undefined) {
    updateData.leiArticles = data.leiArticles ? JSON.stringify(data.leiArticles) : null;
  }
  if (data.aiKeyPoints !== undefined) {
    updateData.aiKeyPoints = data.aiKeyPoints ? JSON.stringify(data.aiKeyPoints) : null;
  }
  // prerequisiteId: null means remove, string means set
  if (data.prerequisiteId !== undefined) {
    updateData.prerequisiteId = data.prerequisiteId || null;
  }

  const lesson = await prisma.lesson.update({
    where: { id },
    data: updateData,
  });

  apiLogger.info({ lessonId: id }, 'Lesson updated');
  return NextResponse.json({ lesson });
});

/**
 * DELETE: Remove uma lição (cascade)
 */
export const DELETE = withAdminApi<{ id: string }>(async (_request, { params }) => {
  const { id } = params;

  const existing = await prisma.lesson.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Lição');
  }

  await prisma.lesson.delete({ where: { id } });

  apiLogger.info({ lessonId: id }, 'Lesson deleted');
  return NextResponse.json({ success: true });
});
