import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/glossary/search?q=termo - Buscar termos
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        terms: [],
        total: 0,
      });
    }

    const searchTerm = query.trim();

    // Buscar em term e definition
    const terms = await prisma.glossaryTerm.findMany({
      where: {
        isPublic: true,
        OR: [
          {
            term: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            definition: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            shortDef: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        term: true,
        slug: true,
        definition: true,
        shortDef: true,
        category: true,
        viewCount: true,
        leiArticles: true,
        relatedTerms: true,
      },
      orderBy: [
        // Termos que começam com a busca aparecem primeiro
        {
          term: 'asc',
        },
      ],
      take: 20,
    });

    // Resolver relatedTerms: IDs → { id, term, slug }
    const allRelatedIds = new Set<string>();
    for (const t of terms) {
      if (t.relatedTerms) {
        try {
          const ids = JSON.parse(t.relatedTerms);
          if (Array.isArray(ids)) ids.forEach((id: string) => allRelatedIds.add(id));
        } catch { /* ignore */ }
      }
    }

    let relatedMap = new Map<string, { id: string; term: string; slug: string }>();
    if (allRelatedIds.size > 0) {
      const relatedRecords = await prisma.glossaryTerm.findMany({
        where: { id: { in: [...allRelatedIds] } },
        select: { id: true, term: true, slug: true },
      });
      relatedMap = new Map(relatedRecords.map(r => [r.id, r]));
    }

    const enrichedTerms = terms.map(t => {
      let resolvedRelatedTerms: { id: string; term: string; slug: string }[] = [];
      if (t.relatedTerms) {
        try {
          const ids = JSON.parse(t.relatedTerms);
          if (Array.isArray(ids)) {
            resolvedRelatedTerms = ids
              .map((id: string) => relatedMap.get(id))
              .filter(Boolean) as { id: string; term: string; slug: string }[];
          }
        } catch { /* ignore */ }
      }
      return { ...t, resolvedRelatedTerms };
    });

    return NextResponse.json({
      terms: enrichedTerms,
      total: terms.length,
      query: searchTerm,
    });
  } catch (error) {
    console.error('Error searching glossary:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar termos' },
      { status: 500 }
    );
  }
}
