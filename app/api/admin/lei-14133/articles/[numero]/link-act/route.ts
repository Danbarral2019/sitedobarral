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
  const actId = String(body?.actId || '').trim();
  if (!actId) {
    return NextResponse.json({ error: 'actId obrigatório' }, { status: 422 });
  }

  const act = await prisma.legislativeAct.findUnique({
    where: { id: actId },
    select: { id: true, leiArticles: true },
  });
  if (!act) return NextResponse.json({ error: 'Ato não encontrado' }, { status: 404 });

  const current = safeParseArray(act.leiArticles).map(String);
  if (current.includes(numero)) {
    return NextResponse.json({ success: true, alreadyLinked: true });
  }
  const next = [...current, numero];

  await prisma.legislativeAct.update({
    where: { id: actId },
    data: { leiArticles: JSON.stringify(next) },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
