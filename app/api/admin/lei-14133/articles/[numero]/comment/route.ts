import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { CommentSchema } from '@/lib/lei-14133/admin-validators';
import { prisma } from '@/lib/prisma';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const PUT = withAdminApi<{ numero: string }>(async (request, ctx) => {
  const { numero } = ctx.params;
  const body = await request.json();
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(422, 'Validação falhou', 'VALIDATION_ERROR', { issues: parsed.error.issues });
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
