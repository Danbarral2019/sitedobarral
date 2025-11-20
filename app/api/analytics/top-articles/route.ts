import { NextRequest, NextResponse } from 'next/server';
import { getTopArticles, getDocumentCountByArticle } from '@/lib/article-utils';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Valida limit
    const validLimit = Math.min(Math.max(limit, 1), 50); // Entre 1 e 50

    // Buscar top artigos
    const articlesData = await getTopArticles(validLimit);

    // Formatar para o widget
    const topArticles = articlesData.map(item => ({
      numero: item.numero,
      ementa: item.article.ementa.substring(0, 100) + (item.article.ementa.length > 100 ? '...' : ''),
      titulo: item.article.titulo || '',
      documentCount: item.documentCount,
      viewCount: item.viewCount,
    }));

    // Stats gerais
    const totalArticles = await prisma.leiArticle.count();

    const docCounts = await getDocumentCountByArticle();
    const totalDocuments = Object.values(docCounts).reduce((sum, count) => sum + count, 0);
    const articlesWithDocs = Object.keys(docCounts).length;
    const coveragePercent = Math.round((articlesWithDocs / totalArticles) * 100);

    return NextResponse.json({
      topArticles,
      totalArticles,
      totalDocuments,
      coveragePercent,
    });
  } catch (error) {
    console.error('Erro ao buscar top artigos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar top artigos' },
      { status: 500 }
    );
  }
}
