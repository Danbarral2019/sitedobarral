import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { parseLeiArticles, setLeiArticles, getLeiArticles } from '@/lib/lei-articles';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const DELETE = withAdminApi<{ numero: string; documentId: string }>(async (_request, { params }) => {
  const { numero, documentId } = params;
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, leiArticlesArr: true },
  });
  if (!doc) throw new NotFoundError('Documento');

  const current = getLeiArticles(doc);
  const next = current.filter((n) => n !== numero);

  await prisma.document.update({
    where: { id: documentId },
    data: { ...setLeiArticles(next.length > 0 ? next : null) },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
});
