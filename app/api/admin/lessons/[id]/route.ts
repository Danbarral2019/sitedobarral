import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { UpdateLessonSchema } from '@/lib/validation-schemas';
import { verifyAdmin } from '@/lib/api-middleware';

/**
 * GET: Busca uma lição por ID com relacionamentos
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;

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
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT: Atualiza uma lição
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;
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

    const lesson = await prisma.lesson.update({
      where: { id },
      data: updateData,
    });

    apiLogger.info({ lessonId: id }, 'Lesson updated');
    return NextResponse.json({ lesson });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE: Remove uma lição (cascade)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if (auth.error) return auth.response;

    const { id } = await params;

    const existing = await prisma.lesson.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Lição');
    }

    await prisma.lesson.delete({ where: { id } });

    apiLogger.info({ lessonId: id }, 'Lesson deleted');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
