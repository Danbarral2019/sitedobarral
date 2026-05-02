import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { ReadingUpdateSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, id } = await params;
  const body = await request.json();
  const parsed = ReadingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const existing = await prisma.leiArticleSuggestedReading.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    return NextResponse.json({ error: 'Reading não encontrado' }, { status: 404 });
  }

  const updated = await prisma.leiArticleSuggestedReading.update({
    where: { id },
    data: {
      kind: parsed.data.kind,
      internalType: parsed.data.internalType ?? null,
      internalId: parsed.data.internalId ?? null,
      externalUrl: parsed.data.externalUrl ?? null,
      externalType: parsed.data.externalType ?? null,
      title: parsed.data.title ?? null,
      description: parsed.data.description ?? null,
      author: parsed.data.author ?? null,
      ...(parsed.data.order !== undefined && { order: parsed.data.order }),
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, reading: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; id: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, id } = await params;
  const existing = await prisma.leiArticleSuggestedReading.findUnique({ where: { id } });
  if (!existing || existing.articleNumber !== numero) {
    return NextResponse.json({ error: 'Reading não encontrado' }, { status: 404 });
  }

  await prisma.leiArticleSuggestedReading.delete({ where: { id } });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
