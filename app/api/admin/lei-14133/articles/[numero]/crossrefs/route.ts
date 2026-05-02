import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { CrossRefSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const list = await prisma.leiArticleCrossRef.findMany({
    where: { articleNumber: numero },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json({ crossRefs: list });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const parsed = CrossRefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const [article, target] = await Promise.all([
    prisma.leiArticle.findUnique({ where: { numero }, select: { numero: true } }),
    prisma.leiArticle.findUnique({ where: { numero: parsed.data.targetNumber }, select: { numero: true } }),
  ]);
  if (!article) return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });
  if (!target) {
    return NextResponse.json({ error: `Artigo destino ${parsed.data.targetNumber} não existe na Lei 14.133` }, { status: 422 });
  }
  if (parsed.data.targetNumber === numero) {
    return NextResponse.json({ error: 'Não é possível vincular um artigo a ele mesmo' }, { status: 422 });
  }

  let order = parsed.data.order;
  if (order === undefined) {
    const last = await prisma.leiArticleCrossRef.findFirst({
      where: { articleNumber: numero },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    order = last ? last.order + 1 : 0;
  }

  const created = await prisma.leiArticleCrossRef.create({
    data: {
      articleNumber: numero,
      targetNumber: parsed.data.targetNumber,
      note: parsed.data.note,
      order,
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, crossRef: created });
}
