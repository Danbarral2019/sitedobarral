import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { withUserApi } from '@/lib/api/handler';
import { AuthorizationError, ValidationError } from '@/lib/errors/api-error';
import { getAcessoDoUsuario } from '@/lib/search/acesso-documentos';

/**
 * GET /api/course-videos?courseId=X
 *
 * Vídeos ativos de um curso. A URL do vídeo é o próprio conteúdo pago, por
 * isso exige login e acesso válido ao curso (matrícula válida ou assinatura
 * que o cubra; admin vê todos), e a resposta não vai para cache compartilhado.
 */
export const GET = withUserApi(async (request, { user }) => {
  const courseId = request.nextUrl.searchParams.get('courseId');
  if (!courseId) {
    throw new ValidationError('courseId is required');
  }

  const acesso = await getAcessoDoUsuario(user);
  if (!acesso.isAdmin && !acesso.cursosAtivos.includes(courseId)) {
    throw new AuthorizationError('Sem acesso a este curso.');
  }

  const result = await withCache(
    CacheKeys.courseVideos(courseId),
    async () => {
      const videos = await prisma.courseVideo.findMany({
        where: {
          courseId: courseId,
          isActive: true,
        },
        orderBy: {
          displayOrder: 'asc',
        },
        select: {
          id: true,
          title: true,
          description: true,
          youtubeUrl: true,
          youtubeId: true,
          thumbnailUrl: true,
        },
      });
      return { videos };
    },
    CACHE_TTL.COURSE_VIDEOS,
    { prefix: 'videos' }
  );

  return NextResponse.json(result, {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
  });
});
