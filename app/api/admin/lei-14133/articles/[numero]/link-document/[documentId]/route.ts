import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; documentId: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, documentId } = await params;
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, leiArticles: true },
  });
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

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
}
