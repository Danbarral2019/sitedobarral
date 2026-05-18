import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { parseLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from "@/lib/logger";

// GET /api/analytics/article-stats - Estatísticas de documentos por artigo
export async function GET() {
  try {
    const result = await withCache(
      CacheKeys.adminAnalytics('stats'),
      async () => {
        const documents = await prisma.document.findMany({
          where: {
            leiArticles: {
              not: null,
            },
          },
          select: {
            id: true,
            leiArticles: true,
          },
        });

        const articleCounts: Record<string, number> = {};

        documents.forEach((doc) => {
          if (!doc.leiArticles) return;

          try {
            const articles: string[] = parseLeiArticles(doc.leiArticles);

            articles.forEach((articleNum) => {
              const normalized = articleNum.replace(/^art\.?\s*/i, '').trim();

              if (!articleCounts[normalized]) {
                articleCounts[normalized] = 0;
              }
              articleCounts[normalized]++;
            });
          } catch (error) {
            apiLogger.error({ docId: doc.id, err: error }, 'Erro ao parsear leiArticles');
          }
        });

        const articleViews = await prisma.accessLog.groupBy({
          by: ['documentId'],
          where: {
            action: 'view',
            documentId: {
              not: null,
            },
          },
          _count: {
            _all: true,
          },
        });

        const viewCounts: Record<string, number> = {};

        // Map documentId → view count
        const docViewMap: Record<string, number> = {};
        articleViews.forEach((log) => {
          if (log.documentId) {
            docViewMap[log.documentId] = log._count._all;
          }
        });

        // Map views to articles via document leiArticles
        documents.forEach((doc) => {
          if (!doc.leiArticles) return;
          const viewCount = docViewMap[doc.id] || 0;
          if (viewCount === 0) return;

          try {
            const articles: string[] = parseLeiArticles(doc.leiArticles);
            articles.forEach((articleNum) => {
              const normalized = articleNum.replace(/^art\.?\s*/i, '').trim();
              viewCounts[normalized] = (viewCounts[normalized] || 0) + viewCount;
            });
          } catch (error) {
            apiLogger.error({ docId: doc.id, err: error }, 'Erro ao parsear leiArticles para views');
          }
        });

        const allArticles = new Set([...Object.keys(articleCounts), ...Object.keys(viewCounts)]);

        const stats = Array.from(allArticles).map((articleNum) => ({
          articleNumber: articleNum,
          documentCount: articleCounts[articleNum] || 0,
          viewCount: viewCounts[articleNum] || 0,
          totalActivity: (articleCounts[articleNum] || 0) + (viewCounts[articleNum] || 0),
        }));

        stats.sort((a, b) => b.totalActivity - a.totalActivity);

        const top50 = stats.slice(0, 50);

        const statsMap: Record<string, { documentCount: number; viewCount: number }> = {};

        stats.forEach((stat) => {
          statsMap[stat.articleNumber] = {
            documentCount: stat.documentCount,
            viewCount: stat.viewCount,
          };
        });

        return {
          topArticles: top50,
          statsMap,
          totalArticles: stats.length,
          totalDocuments: documents.length,
        };
      },
      CACHE_TTL.ADMIN_ANALYTICS,
      { prefix: 'analytics' }
    );

    return NextResponse.json(result);
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao buscar estatísticas de artigos:');
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    );
  }
}
