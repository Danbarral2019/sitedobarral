import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string; actId: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero, actId } = await params;
  const act = await prisma.legislativeAct.findUnique({
    where: { id: actId },
    select: { id: true, leiArticles: true },
  });
  if (!act) return NextResponse.json({ error: 'Ato não encontrado' }, { status: 404 });

  const current = safeParseArray(act.leiArticles).map(String);
  const next = current.filter((n) => n !== numero);

  await prisma.legislativeAct.update({
    where: { id: actId },
    data: { leiArticles: next.length > 0 ? JSON.stringify(next) : null },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true });
}
