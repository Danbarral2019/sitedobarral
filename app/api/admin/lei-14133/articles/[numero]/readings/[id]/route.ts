import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { ReadingUpdateSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const PUT = withAdminApi<{ numero: string; id: string }>(async (request, { params }) => {
  const { numero, id } = params;
  const body = await request.json();
  const parsed = ReadingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(422, 'Validação falhou', 'VALIDATION_ERROR', parsed.error.issues);
  }

  const existing = await prisma.leiArticleSuggestedReading.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    throw new NotFoundError('Reading');
  }

  const updated = await prisma.leiArticleSuggestedReading.update({
    where: { id },
    data: {
      kind: parsed.data.kind,
      internalType: parsed.data.internalType ?? null,
      internalId: parsed.data.internalId ?? null,
      externalUrl: parsed.data.externalUrl ?? null,
      externalType: parsed.data.externalType ?? null,
      title: parsed.data.title ?? null,
      description: parsed.data.description ?? null,
      author: parsed.data.author ?? null,
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, reading: updated });
});

export const DELETE = withAdminApi<{ numero: string; id: string }>(async (_request, { params }) => {
  const { numero, id } = params;
  const existing = await prisma.leiArticleSuggestedReading.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    throw new NotFoundError('Reading');
  }

  await prisma.leiArticleSuggestedReading.delete({ where: { id } });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
});
