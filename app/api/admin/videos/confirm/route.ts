import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';
import { fileExistsInR2 } from '@/lib/storage/r2-client';
import { prisma } from '@/lib/prisma';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { apiLogger } from '@/lib/logger';

interface Body {
  courseId: string;
  title: string;
  description?: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds?: number;
}

export const POST = withAdminApi(async (request) => {
  const body = (await request.json()) as Body;

  if (!body.courseId || !body.title || !body.r2Key || !body.contentType) {
    throw new ValidationError('Campos obrigatórios faltando (courseId, title, r2Key, contentType)');
  }
  if (!body.r2Key.startsWith('videos/')) {
    throw new ValidationError('r2Key inválida');
  }

  // Garante que o upload chegou ao R2 antes de gravar o registro
  const exists = await fileExistsInR2(body.r2Key);
  if (!exists) {
    throw new NotFoundError('Arquivo de vídeo no R2');
  }

  const last = await prisma.courseVideo.findFirst({
    where: { courseId: body.courseId },
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true },
  });

  const video = await prisma.courseVideo.create({
    data: {
      courseId: body.courseId,
      title: body.title,
      description: body.description || null,
      storageType: 'r2',
      r2Key: body.r2Key,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes != null ? String(body.sizeBytes) : null,
      durationSeconds: body.durationSeconds ?? null,
      youtubeUrl: null,
      youtubeId: null,
      thumbnailUrl: null,
      displayOrder: last ? last.displayOrder + 1 : 0,
      isActive: true,
    },
  });

  CacheInvalidation.courseVideos().catch((err) =>
    apiLogger.error({ err }, 'Falha ao invalidar cache de vídeos após confirm R2')
  );

  return NextResponse.json({ video }, { status: 201 });
});
