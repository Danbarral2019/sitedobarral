import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { CrossRefUpdateSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, id } = await params;
  const body = await request.json();
  const parsed = CrossRefUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const existing = await prisma.leiArticleCrossRef.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    return NextResponse.json({ error: 'CrossRef não encontrado' }, { status: 404 });
  }

  const updated = await prisma.leiArticleCrossRef.update({
    where: { id },
    data: {
      ...(parsed.data.targetNumber !== undefined && { targetNumber: parsed.data.targetNumber }),
      ...(parsed.data.note !== undefined && { note: parsed.data.note }),
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, crossRef: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, id } = await params;
  const existing = await prisma.leiArticleCrossRef.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    return NextResponse.json({ error: 'CrossRef não encontrado' }, { status: 404 });
  }

  await prisma.leiArticleCrossRef.delete({ where: { id } });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
