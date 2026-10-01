import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { getLeiArticles } from '@/lib/lei-articles';
import { PUBLIC_DOCUMENT_WHERE } from '@/lib/document-categories';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';

interface ArticleRelationship {
  articleNumber: string;
  coOccurrences: number;
  strength: number;
  sharedDocuments: number;
}

// GET /api/artigos/[numero]/relationships - Obter artigos relacionados por co-ocorrência
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero: articleNumber } = await params;

    if (!articleNumber) {
      throw new ValidationError('Número do artigo é obrigatório');
    }

    const result = await withCache(
      CacheKeys.articleDetails(articleNumber, 'rel-pub'),
      async () => {
        const documentsWithThisArticle = await prisma.document.findMany({
          where: {
            ...PUBLIC_DOCUMENT_WHERE,
            leiArticlesArr: {
              has: articleNumber,
            },
          },
          select: {
            id: true,
            leiArticlesArr: true,
          },
        });

        if (documentsWithThisArticle.length === 0) {
          return {
            articleNumber,
            relationships: [],
            totalDocuments: 0,
          };
        }

        const coOccurrenceMap = new Map<string, number>();

        documentsWithThisArticle.forEach((doc) => {
          const articles = getLeiArticles(doc);
          articles.forEach((otherArticle) => {
            const normalized = String(otherArticle).trim();
            if (normalized === articleNumber) return;
            const current = coOccurrenceMap.get(normalized) || 0;
            coOccurrenceMap.set(normalized, current + 1);
          });
        });

        const totalDocs = documentsWithThisArticle.length;
        const relationships: ArticleRelationship[] = [];

        coOccurrenceMap.forEach((count, article) => {
          const strength = Math.round((count / totalDocs) * 100);
          relationships.push({
            articleNumber: article,
            coOccurrences: count,
            strength,
            sharedDocuments: count,
          });
        });

        relationships.sort((a, b) => b.strength - a.strength);
        const topRelationships = relationships.slice(0, 20);

        return {
          articleNumber,
          relationships: topRelationships,
          totalDocuments: totalDocs,
          totalRelatedArticles: relationships.length,
        };
      },
      CACHE_TTL.ARTICLE_DETAILS,
      { prefix: 'article' }
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
