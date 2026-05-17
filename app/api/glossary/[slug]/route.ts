import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { parseLeiArticles } from '@/lib/lei-articles';

// GET /api/glossary/[slug] - Obter termo específico por slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const term = await prisma.glossaryTerm.findUnique({
      where: { slug },
    });

    if (!term) {
      return NextResponse.json(
        { error: 'Termo não encontrado' },
        { status: 404 }
      );
    }

    if (!term.isPublic) {
      return NextResponse.json(
        { error: 'Termo não disponível' },
        { status: 403 }
      );
    }

    // Incrementar contador de visualizações (async, não espera)
    prisma.glossaryTerm
      .update({
        where: { id: term.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err) => console.error('Error updating view count:', err));

    // Cache the enriched term data (related terms, docs, etc.)
    const enrichedData = await withCache(
      CacheKeys.glossaryTerms({ category: slug }),
      async () => {
        let relatedTerms: { id: string; term: string; slug: string; shortDef: string | null; category: string | null }[] = [];
        if (term.relatedTerms) {
          try {
            const relatedIds = JSON.parse(term.relatedTerms);
            if (Array.isArray(relatedIds) && relatedIds.length > 0) {
              relatedTerms = await prisma.glossaryTerm.findMany({
                where: {
                  id: { in: relatedIds },
                  isPublic: true,
                },
                select: {
                  id: true,
                  term: true,
                  slug: true,
                  shortDef: true,
                  category: true,
                },
              });
            }
          } catch (e) {
            console.error('Error parsing relatedTerms:', e);
          }
        }

        let relatedDocuments: { id: string; title: string; description: string | null; type: string; category: string; courseId: string | null }[] = [];
        if (term.relatedDocs) {
          try {
            const docIds = JSON.parse(term.relatedDocs);
            if (Array.isArray(docIds) && docIds.length > 0) {
              relatedDocuments = await prisma.document.findMany({
                where: {
                  id: { in: docIds },
                },
                select: {
                  id: true,
                  title: true,
                  description: true,
                  type: true,
                  category: true,
                  courseId: true,
                },
                take: 10,
              });
            }
          } catch (e) {
            console.error('Error parsing relatedDocs:', e);
          }
        }

        const leiArticles: string[] = parseLeiArticles(term.leiArticles);

        return { relatedTerms, relatedDocuments, leiArticles };
      },
      CACHE_TTL.GLOSSARY,
      { prefix: 'glossary' }
    );

    return NextResponse.json({
      term: {
        ...term,
        relatedTerms: enrichedData.relatedTerms,
        relatedDocuments: enrichedData.relatedDocuments,
        leiArticles: enrichedData.leiArticles,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    console.error('Error fetching glossary term:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar termo' },
      { status: 500 }
    );
  }
}
