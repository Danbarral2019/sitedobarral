import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const POST = withAdminApi<{ numero: string }>(async (request, ctx) => {
  const { numero } = ctx.params;
  const body = await request.json();
  const actId = String(body?.actId || '').trim();
  if (!actId) {
    throw new ApiError(422, 'actId obrigatório', 'VALIDATION_ERROR');
  }

  const act = await prisma.legislativeAct.findUnique({
    where: { id: actId },
    select: { id: true, leiArticles: true },
  });
  if (!act) throw new NotFoundError('Ato');

  const current = safeParseArray(act.leiArticles).map(String);
  if (current.includes(numero)) {
    return NextResponse.json({ success: true, alreadyLinked: true });
  }
  const next = [...current, numero];

  await prisma.legislativeAct.update({
    where: { id: actId },
    data: { leiArticles: JSON.stringify(next) },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
});
