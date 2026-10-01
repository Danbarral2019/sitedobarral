import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { getLeiArticles } from '@/lib/lei-articles';
import { PUBLIC_DOCUMENT_WHERE } from '@/lib/document-categories';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthorizationError, NotFoundError } from '@/lib/errors/api-error';

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
      throw new NotFoundError('Termo');
    }

    if (!term.isPublic) {
      throw new AuthorizationError('Termo não disponível');
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
                  id: { in: docIds.filter((d): d is string => typeof d === 'string') },
                  ...PUBLIC_DOCUMENT_WHERE,
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

        const leiArticles: string[] = getLeiArticles(term);

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
    return handleApiError(error);
  }
}
