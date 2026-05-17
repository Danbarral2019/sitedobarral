import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ApiError, NotFoundError } from '@/lib/errors/api-error';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const POST = withAdminApi<{ numero: string }>(async (request, { params }) => {
  const { numero } = params;
  const body = await request.json();
  const documentId = String(body?.documentId || '').trim();
  if (!documentId) {
    throw new ApiError(422, 'documentId obrigatório', 'VALIDATION_ERROR');
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, leiArticles: true },
  });
  if (!doc) throw new NotFoundError('Documento');

  const current = safeParseArray(doc.leiArticles).map(String);
  if (current.includes(numero)) {
    return NextResponse.json({ success: true, alreadyLinked: true });
  }
  const next = [...current, numero];

  await prisma.document.update({
    where: { id: documentId },
    data: { leiArticles: JSON.stringify(next) },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
});
