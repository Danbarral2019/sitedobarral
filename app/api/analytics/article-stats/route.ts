import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/analytics/article-stats - Estatísticas de documentos por artigo
export async function GET() {
  try {
    // Buscar todos os documentos com leiArticles
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

    // Contar documentos por artigo
    const articleCounts: Record<string, number> = {};

    documents.forEach((doc) => {
      if (!doc.leiArticles) return;

      try {
        // leiArticles é um JSON array de strings
        const articles: string[] = JSON.parse(doc.leiArticles);

        articles.forEach((articleNum) => {
          // Normalizar número do artigo (remover "art" e espaços)
          const normalized = articleNum.replace(/^art\.?\s*/i, '').trim();

          if (!articleCounts[normalized]) {
            articleCounts[normalized] = 0;
          }
          articleCounts[normalized]++;
        });
      } catch (error) {
        console.error('Erro ao parsear leiArticles:', doc.id, error);
      }
    });

    // Buscar views de artigos (AccessLog)
    const articleViews = await prisma.accessLog.groupBy({
      by: ['metadata'],
      where: {
        action: 'view_article',
        metadata: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
    });

    // Mapear views por artigo
    const viewCounts: Record<string, number> = {};

    articleViews.forEach((log) => {
      if (!log.metadata) return;

      try {
        const metadata = JSON.parse(log.metadata);
        if (metadata.articleNumber) {
          const normalized = String(metadata.articleNumber);
          viewCounts[normalized] = (viewCounts[normalized] || 0) + log._count.id;
        }
      } catch (error) {
        console.error('Erro ao parsear metadata:', error);
      }
    });

    // Combinar dados
    const allArticles = new Set([...Object.keys(articleCounts), ...Object.keys(viewCounts)]);

    const stats = Array.from(allArticles).map((articleNum) => ({
      articleNumber: articleNum,
      documentCount: articleCounts[articleNum] || 0,
      viewCount: viewCounts[articleNum] || 0,
      totalActivity: (articleCounts[articleNum] || 0) + (viewCounts[articleNum] || 0),
    }));

    // Ordenar por atividade total
    stats.sort((a, b) => b.totalActivity - a.totalActivity);

    // Retornar top 50 artigos
    const top50 = stats.slice(0, 50);

    // Criar mapa de estatísticas (para ArticleTreeNavigator)
    const statsMap: Record<string, { documentCount: number; viewCount: number }> = {};

    stats.forEach((stat) => {
      statsMap[stat.articleNumber] = {
        documentCount: stat.documentCount,
        viewCount: stat.viewCount,
      };
    });

    return NextResponse.json({
      topArticles: top50,
      statsMap,
      totalArticles: stats.length,
      totalDocuments: documents.length,
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas de artigos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    );
  }
}
