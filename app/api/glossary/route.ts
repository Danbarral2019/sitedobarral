import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

import { Prisma } from '@prisma/client';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 30;

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// GET /api/glossary - Listar termos públicos com busca, filtros e paginação
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category')?.trim() || null;
    const letter = searchParams.get('letter')?.trim().toUpperCase() || null;
    const query = searchParams.get('q')?.trim() || null;
    const page = positiveInteger(searchParams.get('page'), 1);
    const pageSize = Math.min(
      positiveInteger(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    if (letter && !/^[A-Z]$/.test(letter)) {
      return NextResponse.json({ error: 'Letra inválida' }, { status: 400 });
    }

    if ((category?.length ?? 0) > 100 || (query?.length ?? 0) > 200) {
      return NextResponse.json({ error: 'Filtro inválido' }, { status: 400 });
    }

    // Generate cache key based on filters
    const cacheKey = CacheKeys.glossaryTerms({
      category,
      letter,
      query,
      page,
      pageSize,
    });

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
            startsWith: letter,
            mode: 'insensitive',
          };
        }

        if (query) {
          where.OR = [
            { term: { contains: query, mode: 'insensitive' } },
            { definition: { contains: query, mode: 'insensitive' } },
            { shortDef: { contains: query, mode: 'insensitive' } },
          ];
        }

        // Buscar termos
        const [terms, total, allTerms] = await Promise.all([
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
            take: pageSize,
            skip,
          }),
          prisma.glossaryTerm.count({ where }),
          prisma.glossaryTerm.findMany({
            where: { isPublic: true },
            select: { term: true, category: true },
          }),
        ]);

        const categories = [...new Set(allTerms.map((t) => t.category).filter(Boolean))].sort();
        const availableLetters = [
          ...new Set(
            allTerms
              .map((term) => term.term.charAt(0).toUpperCase())
              .filter((firstLetter) => /^[A-Z]$/.test(firstLetter)),
          ),
        ].sort();

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

        const totalPages = Math.ceil(total / pageSize);

        return {
          terms: enrichedTerms,
          categories,
          availableLetters,
          pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasMore: page < totalPages,
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
