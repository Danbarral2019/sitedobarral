import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const DELETE = withAdminApi<{ numero: string; documentId: string }>(async (_request, { params }) => {
  const { numero, documentId } = params;
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, leiArticles: true },
  });
  if (!doc) throw new NotFoundError('Documento');

  const current = safeParseArray(doc.leiArticles).map(String);
  const next = current.filter((n) => n !== numero);

  await prisma.document.update({
    where: { id: documentId },
    data: { leiArticles: next.length > 0 ? JSON.stringify(next) : null },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
});
