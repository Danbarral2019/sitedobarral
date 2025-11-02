import { NextRequest, NextResponse } from 'next/server';
import { getTopArticles } from '@/lib/article-utils';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Valida limit
    const validLimit = Math.min(Math.max(limit, 1), 50); // Entre 1 e 50

    const articles = await getTopArticles(validLimit);

    return NextResponse.json({
      articles,
      total: articles.length,
      limit: validLimit,
    });
  } catch (error) {
    console.error('Erro ao buscar top artigos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar top artigos' },
      { status: 500 }
    );
  }
}
