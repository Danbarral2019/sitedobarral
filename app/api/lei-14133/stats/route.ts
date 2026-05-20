import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractArticleNumbers } from '@/lib/article-utils';

export async function GET() {
  try {
    const documents = await prisma.document.findMany({
      where: {
        leiArticlesArr: { isEmpty: false },
      },
      select: {
        leiArticlesArr: true,
      },
    });

    const articleCounts: Record<string, number> = {};
    let totalDocuments = 0;

    for (const doc of documents) {
      for (const article of doc.leiArticlesArr) {
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
    console.error('Error fetching article stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article statistics' },
      { status: 500 }
    );
  }
}
