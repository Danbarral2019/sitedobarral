import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { ReadingSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const GET = withAdminApi<{ numero: string }>(async (_request, { params }) => {
  const { numero } = params;
  const list = await prisma.leiArticleSuggestedReading.findMany({
    where: { articleNumber: numero },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json({ readings: list });
});

export const POST = withAdminApi<{ numero: string }>(async (request, { params }) => {
  const { numero } = params;
  const body = await request.json();
  const parsed = ReadingSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(422, 'Validação falhou', 'VALIDATION_ERROR', parsed.error.issues);
  }

  const article = await prisma.leiArticle.findUnique({ where: { numero }, select: { numero: true } });
  if (!article) throw new NotFoundError('Artigo');

  let order = parsed.data.order;
  if (order === undefined) {
    const last = await prisma.leiArticleSuggestedReading.findFirst({
      where: { articleNumber: numero },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    order = last ? last.order + 1 : 0;
  }

  const created = await prisma.leiArticleSuggestedReading.create({
    data: {
      articleNumber: numero,
      kind: parsed.data.kind,
      internalType: parsed.data.internalType,
      internalId: parsed.data.internalId,
      externalUrl: parsed.data.externalUrl,
      externalType: parsed.data.externalType,
      title: parsed.data.title,
      description: parsed.data.description,
      author: parsed.data.author,
      order,
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, reading: created });
});
