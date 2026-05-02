import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { ReadingSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const list = await prisma.leiArticleSuggestedReading.findMany({
    where: { articleNumber: numero },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json({ readings: list });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const parsed = ReadingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const article = await prisma.leiArticle.findUnique({ where: { numero }, select: { numero: true } });
  if (!article) return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });

  let order = parsed.data.order;
  if (order === undefined) {
    const last = await prisma.leiArticleSuggestedReading.findFirst({
      where: { articleNumber: numero },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    order = last ? last.order + 1 : 0;
  }

  const created = await prisma.leiArticleSuggestedReading.create({
    data: {
      articleNumber: numero,
      kind: parsed.data.kind,
      internalType: parsed.data.internalType,
      internalId: parsed.data.internalId,
      externalUrl: parsed.data.externalUrl,
      externalType: parsed.data.externalType,
      title: parsed.data.title,
      description: parsed.data.description,
      author: parsed.data.author,
      order,
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, reading: created });
}
