import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { CrossRefSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const GET = withAdminApi<{ numero: string }>(async (_request, { params }) => {
  const { numero } = params;
  const list = await prisma.leiArticleCrossRef.findMany({
    where: { articleNumber: numero },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json({ crossRefs: list });
});

export const POST = withAdminApi<{ numero: string }>(async (request, { params }) => {
  const { numero } = params;
  const body = await request.json();
  const parsed = CrossRefSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(422, 'Validação falhou', 'VALIDATION_ERROR', parsed.error.issues);
  }

  const [article, target] = await Promise.all([
    prisma.leiArticle.findUnique({ where: { numero }, select: { numero: true } }),
    prisma.leiArticle.findUnique({ where: { numero: parsed.data.targetNumber }, select: { numero: true } }),
  ]);
  if (!article) throw new NotFoundError('Artigo');
  if (!target) {
    throw new ApiError(422, `Artigo destino ${parsed.data.targetNumber} não existe na Lei 14.133`, 'VALIDATION_ERROR');
  }
  if (parsed.data.targetNumber === numero) {
    throw new ApiError(422, 'Não é possível vincular um artigo a ele mesmo', 'VALIDATION_ERROR');
  }

  let order = parsed.data.order;
  if (order === undefined) {
    const last = await prisma.leiArticleCrossRef.findFirst({
      where: { articleNumber: numero },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    order = last ? last.order + 1 : 0;
  }

  const created = await prisma.leiArticleCrossRef.create({
    data: {
      articleNumber: numero,
      targetNumber: parsed.data.targetNumber,
      note: parsed.data.note,
      order,
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, crossRef: created });
});
