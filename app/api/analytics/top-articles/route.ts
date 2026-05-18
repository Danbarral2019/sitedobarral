import { NextRequest, NextResponse } from 'next/server';
import { getTopArticles, getDocumentCountByArticle } from '@/lib/article-utils';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { apiLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const validLimit = Math.min(Math.max(limit, 1), 50);

    const result = await withCache(
      CacheKeys.adminAnalytics('top', { limit: validLimit }),
      async () => {
        const articlesData = await getTopArticles(validLimit);

        const topArticles = articlesData.map(item => ({
          numero: item.numero,
          ementa: item.article.ementa.substring(0, 100) + (item.article.ementa.length > 100 ? '...' : ''),
          titulo: item.article.titulo || '',
          documentCount: item.documentCount,
          viewCount: item.viewCount,
        }));

        const totalArticles = await prisma.leiArticle.count();

        const docCounts = await getDocumentCountByArticle();
        const totalDocuments = Object.values(docCounts).reduce((sum, count) => sum + count, 0);
        const articlesWithDocs = Object.keys(docCounts).length;
        const coveragePercent = Math.round((articlesWithDocs / totalArticles) * 100);

        return {
          topArticles,
          totalArticles,
          totalDocuments,
          coveragePercent,
        };
      },
      CACHE_TTL.ADMIN_ANALYTICS,
      { prefix: 'analytics' }
    );

    return NextResponse.json(result);
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao buscar top artigos:');
    return NextResponse.json(
      { error: 'Erro ao buscar top artigos' },
      { status: 500 }
    );
  }
}
