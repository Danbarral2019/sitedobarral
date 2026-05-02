import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { CommentSchema } from '@/lib/lei-14133/admin-validators';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const body = await request.json();
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', issues: parsed.error.issues }, { status: 422 });
  }

  const article = await prisma.leiArticle.findUnique({ where: { numero } });
  if (!article) {
    return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });
  }

  const updated = await prisma.leiArticle.update({
    where: { numero },
    data: {
      professorComment: parsed.data.markdown || null,
      commentUpdatedAt: parsed.data.markdown ? new Date() : null,
    },
  });

  await Promise.all([
    CacheInvalidation.leiArticles(),
    CacheInvalidation.leiArticle(numero),
  ]);

  return NextResponse.json({ success: true, article: updated });
}
