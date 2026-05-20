import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { parseLeiArticles, setLeiArticles, getLeiArticles } from '@/lib/lei-articles';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const DELETE = withAdminApi<{ numero: string; actId: string }>(async (_request, { params }) => {
  const { numero, actId } = params;
  const act = await prisma.legislativeAct.findUnique({
    where: { id: actId },
    select: { id: true, leiArticles: true, leiArticlesArr: true },
  });
  if (!act) throw new NotFoundError('Ato');

  const current = getLeiArticles(act);
  const next = current.filter((n) => n !== numero);

  await prisma.legislativeAct.update({
    where: { id: actId },
    data: { ...setLeiArticles(next.length > 0 ? next : null) },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
});
