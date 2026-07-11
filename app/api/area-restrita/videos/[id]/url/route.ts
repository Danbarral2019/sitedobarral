import { NextResponse } from 'next/server';
import { withUserApi } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { NotFoundError, AuthorizationError } from '@/lib/errors/api-error';
import { getSignedR2Url } from '@/lib/storage/r2-client';

const PLAYBACK_EXPIRATION = 7200; // 2h

export const GET = withUserApi<{ id: string }>(async (_request, ctx) => {
  const { id } = ctx.params;

  const video = await prisma.courseVideo.findUnique({
    where: { id },
    select: { id: true, courseId: true, storageType: true, r2Key: true },
  });

  if (!video || video.storageType !== 'r2' || !video.r2Key) {
    throw new NotFoundError('Vídeo hospedado');
  }

  // Gate de acesso: mesmo padrão do quiz/submit (enrollment válido).
  // Subscription ativa gera enrollment sem expiresAt → coberto pelo OR.
  if (ctx.user.role !== 'admin') {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: ctx.user.userId,
        courseId: video.courseId,
        OR: [
          { isLifetime: true },
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { id: true },
    });
    if (!enrollment) {
      throw new AuthorizationError('Acesso expirado ou inexistente para este curso.');
    }
  }

  const url = await getSignedR2Url(video.r2Key, PLAYBACK_EXPIRATION, 'GET');
  return NextResponse.json({ url, expiresIn: PLAYBACK_EXPIRATION });
});
