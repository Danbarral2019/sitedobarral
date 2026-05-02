import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/api-middleware';
import { safeParseArray } from '@/lib/utils';

/**
 * GET /api/admin/lei-14133/articles/[numero]
 * Retorna artigo + comentário + crossRefs + suggestedReadings
 * + Documents/LegislativeActs vinculados (filtrando por leiArticles JSON).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> },
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck.error) return adminCheck.response;

  const { numero } = await params;
  const article = await prisma.leiArticle.findUnique({
    where: { numero },
    include: {
      crossRefs: { orderBy: { order: 'asc' } },
      suggestedReadings: { orderBy: { order: 'asc' } },
    },
  });

  if (!article) {
    return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });
  }

  // Documents que linkam este artigo
  const allDocs = await prisma.document.findMany({
    where: { leiArticles: { not: null } },
    select: { id: true, title: true, leiArticles: true, category: true, isPublic: true, notesImportance: true },
  });
  const linkedDocuments = allDocs.filter((d) =>
    safeParseArray(d.leiArticles).map(String).includes(numero),
  );

  // LegislativeActs que linkam este artigo
  const allActs = await prisma.legislativeAct.findMany({
    where: { leiArticles: { not: null } },
    select: {
      id: true,
      fullNumber: true,
      title: true,
      ementa: true,
      type: true,
      hierarchyLevel: true,
      esfera: true,
      importance: true,
      leiArticles: true,
    },
  });
  const linkedActs = allActs.filter((a) =>
    safeParseArray(a.leiArticles).map(String).includes(numero),
  );

  return NextResponse.json({ article, linkedDocuments, linkedActs });
}
