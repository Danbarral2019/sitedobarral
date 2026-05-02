import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { ReorderSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const items = await prisma.leiArticleSuggestedReading.findMany({
    where: { id: { in: parsed.data.ids }, articleNumber: numero },
    select: { id: true },
  });
  if (items.length !== parsed.data.ids.length) {
    return NextResponse.json({ error: 'IDs inválidos' }, { status: 422 });
  }

  await prisma.$transaction(
    parsed.data.ids.map((id, idx) =>
      prisma.leiArticleSuggestedReading.update({ where: { id }, data: { order: idx } }),
    ),
  );

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
