import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const DELETE = withAdminApi<{ numero: string; actId: string }>(async (request, ctx) => {
  const { numero, actId } = ctx.params;
  const act = await prisma.legislativeAct.findUnique({
    where: { id: actId },
    select: { id: true, leiArticles: true },
  });
  if (!act) throw new NotFoundError('Ato');

  const current = safeParseArray(act.leiArticles).map(String);
  const next = current.filter((n) => n !== numero);

  await prisma.legislativeAct.update({
    where: { id: actId },
    data: { leiArticles: next.length > 0 ? JSON.stringify(next) : null },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
});
