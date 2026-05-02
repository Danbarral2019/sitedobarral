import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const documentId = String(body?.documentId || '').trim();
  if (!documentId) {
    return NextResponse.json({ error: 'documentId obrigatório' }, { status: 422 });
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, leiArticles: true },
  });
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

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
}
