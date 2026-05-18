import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { parseLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from "@/lib/logger";

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
      return NextResponse.json(
        { error: 'Número do artigo é obrigatório' },
        { status: 400 }
      );
    }

    const result = await withCache(
      CacheKeys.articleDetails(articleNumber, 'rel'),
      async () => {
        const documentsWithThisArticle = await prisma.document.findMany({
          where: {
            leiArticles: {
              contains: articleNumber,
            },
          },
          select: {
            id: true,
            leiArticles: true,
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
          const articles = parseLeiArticles(doc.leiArticles);
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
    apiLogger.error({ err: error }, 'Erro ao calcular relacionamentos:');
    return NextResponse.json(
      { error: 'Erro ao calcular relacionamentos entre artigos' },
      { status: 500 }
    );
  }
}
