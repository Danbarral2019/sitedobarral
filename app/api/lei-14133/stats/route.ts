import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractArticleNumbers } from '@/lib/article-utils';
import { apiLogger } from "@/lib/logger";

export async function GET() {
  try {
    const documents = await prisma.document.findMany({
      where: {
        leiArticles: { not: null },
      },
      select: {
        leiArticles: true,
      },
    });

    const articleCounts: Record<string, number> = {};
    let totalDocuments = 0;

    for (const doc of documents) {
      const articles = extractArticleNumbers(doc.leiArticles);
      for (const article of articles) {
        articleCounts[article] = (articleCounts[article] || 0) + 1;
        totalDocuments++;
      }
    }

    const totalArticles = Object.keys(articleCounts).length;

    return NextResponse.json(
      {
        articleStats: articleCounts,
        totalArticles,
        totalDocuments,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (error) {
    apiLogger.error({ err: error }, 'Error fetching article stats:');
    return NextResponse.json(
      { error: 'Failed to fetch article statistics' },
      { status: 500 }
    );
  }
}
