import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

import { Prisma } from '@prisma/client';

// GET /api/glossary - Listar todos os termos (com filtros opcionais)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const letter = searchParams.get('letter');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Generate cache key based on filters
    const cacheKey = CacheKeys.glossaryTerms({ category, letter, offset, limit });

    // Use cached result or fetch from database
    const result = await withCache(
      cacheKey,
      async () => {
        // Construir filtros
        const where: Prisma.GlossaryTermWhereInput = {
          isPublic: true,
        };

        if (category) {
          where.category = category;
        }

        if (letter) {
          where.term = {
            startsWith: letter.toUpperCase(),
          };
        }

        // Buscar termos
        const [terms, total] = await Promise.all([
          prisma.glossaryTerm.findMany({
            where,
            select: {
              id: true,
              term: true,
              slug: true,
              definition: true,
              shortDef: true,
              category: true,
              viewCount: true,
              leiArticlesArr: true,
              relatedTerms: true,
            },
            orderBy: {
              term: 'asc',
            },
            take: limit,
            skip: offset,
          }),
          prisma.glossaryTerm.count({ where }),
        ]);

        // Buscar todas as categorias disponíveis
        const allTerms = await prisma.glossaryTerm.findMany({
          where: { isPublic: true },
          select: { category: true },
        });

        const categories = [...new Set(allTerms.map((t) => t.category).filter(Boolean))].sort();

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

        // Enriquecer terms com relatedTerms resolvidos
        const enrichedTerms = terms.map(t => {
          let resolvedRelated: { id: string; term: string; slug: string }[] = [];
          if (t.relatedTerms) {
            try {
              const ids = JSON.parse(t.relatedTerms);
              if (Array.isArray(ids)) {
                resolvedRelated = ids
                  .map((id: string) => relatedMap.get(id))
                  .filter(Boolean) as { id: string; term: string; slug: string }[];
              }
            } catch { /* ignore */ }
          }
          return { ...t, resolvedRelatedTerms: resolvedRelated };
        });

        return {
          terms: enrichedTerms,
          total,
          categories,
          pagination: {
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        };
      },
      CACHE_TTL.GLOSSARY,
      { prefix: 'glossary' }
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    console.error('Error fetching glossary terms:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar termos do glossário' },
      { status: 500 }
    );
  }
}
