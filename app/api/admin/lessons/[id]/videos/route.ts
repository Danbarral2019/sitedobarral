import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError, AuthorizationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { LinkLessonVideoSchema } from '@/lib/validation-schemas';

/**
 * POST: Adiciona um vídeo a uma lição
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { getCurrentUser } = await import('@/lib/auth');
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      throw new AuthorizationError();
    }

    const { id: lessonId } = await params;
    const body = await request.json();
    const data = LinkLessonVideoSchema.parse(body);

    // Verificar se a lição existe
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundError('Lição');
    }

    // Auto-set displayOrder se não fornecido
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const maxOrder = await prisma.lessonVideo.aggregate({
        where: { lessonId },
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;
    }

    const lessonVideo = await prisma.lessonVideo.create({
      data: {
        lessonId,
        courseVideoId: data.courseVideoId,
        title: data.title,
        youtubeUrl: data.youtubeUrl,
        youtubeId: data.youtubeId,
        description: data.description,
        displayOrder,
        isRequired: data.isRequired ?? false,
      },
    });

    apiLogger.info({ lessonId, videoId: lessonVideo.id }, 'Video added to lesson');
    return NextResponse.json({ lessonVideo }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE: Remove um vídeo de uma lição
 * Query param: videoId
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { getCurrentUser } = await import('@/lib/auth');
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      throw new AuthorizationError();
    }

    const { id: lessonId } = await params;
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId é obrigatório' },
        { status: 400 }
      );
    }

    const existing = await prisma.lessonVideo.findUnique({
      where: { id: videoId },
    });
    if (!existing || existing.lessonId !== lessonId) {
      throw new NotFoundError('Vídeo da lição');
    }

    await prisma.lessonVideo.delete({ where: { id: videoId } });

    apiLogger.info({ lessonId, videoId }, 'Video removed from lesson');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
