import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { CommentSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const PUT = withAdminApi<{ numero: string }>(async (request, { params }) => {
  const { numero } = params;
  const body = await request.json();
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(422, 'Validação falhou', 'VALIDATION_ERROR', parsed.error.issues);
  }

  const article = await prisma.leiArticle.findUnique({ where: { numero } });
  if (!article) {
    throw new NotFoundError('Artigo');
  }

  const updated = await prisma.leiArticle.update({
    where: { numero },
    data: {
      professorComment: parsed.data.markdown || null,
      commentUpdatedAt: parsed.data.markdown ? new Date() : null,
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, article: updated });
});
