import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { CrossRefUpdateSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const PUT = withAdminApi<{ numero: string; id: string }>(async (request, { params }) => {
  const { numero, id } = params;
  const body = await request.json();
  const parsed = CrossRefUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(422, 'Validação falhou', 'VALIDATION_ERROR', parsed.error.issues);
  }

  const existing = await prisma.leiArticleCrossRef.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    throw new NotFoundError('CrossRef');
  }

  const updated = await prisma.leiArticleCrossRef.update({
    where: { id },
    data: {
      ...(parsed.data.targetNumber !== undefined && { targetNumber: parsed.data.targetNumber }),
      ...(parsed.data.note !== undefined && { note: parsed.data.note }),
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, crossRef: updated });
});

export const DELETE = withAdminApi<{ numero: string; id: string }>(async (_request, { params }) => {
  const { numero, id } = params;
  const existing = await prisma.leiArticleCrossRef.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    throw new NotFoundError('CrossRef');
  }

  await prisma.leiArticleCrossRef.delete({ where: { id } });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
});
