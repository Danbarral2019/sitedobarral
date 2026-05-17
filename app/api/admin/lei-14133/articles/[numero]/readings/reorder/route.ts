import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/errors/api-error';
import { ReorderSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const POST = withAdminApi<{ numero: string }>(async (request, { params }) => {
  const { numero } = params;
  const body = await request.json();
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(422, 'Validação falhou', 'VALIDATION_ERROR', parsed.error.issues);
  }

  const items = await prisma.leiArticleSuggestedReading.findMany({
    where: { id: { in: parsed.data.ids }, articleNumber: numero },
    select: { id: true },
  });
  if (items.length !== parsed.data.ids.length) {
    throw new ApiError(422, 'IDs inválidos', 'VALIDATION_ERROR');
  }

  await prisma.$transaction(
    parsed.data.ids.map((id, idx) =>
      prisma.leiArticleSuggestedReading.update({ where: { id }, data: { order: idx } }),
    ),
  );

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
});
