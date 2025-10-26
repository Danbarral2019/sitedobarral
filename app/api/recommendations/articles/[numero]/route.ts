import { NextRequest, NextResponse } from 'next/server';
import { getRelatedArticles } from '@/lib/recommendations';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

/**
 * GET /api/recommendations/articles/[numero]
 * Retorna artigos recomendados baseado em um artigo específico
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '6');

    // Valida número do artigo
    const articleNum = parseInt(numero);
    if (isNaN(articleNum) || articleNum < 1 || articleNum > 193) {
      return NextResponse.json(
        { error: 'Número de artigo inválido' },
        { status: 400 }
      );
    }

    // Verifica se artigo existe
    if (!LEI_14133_ARTIGOS[numero]) {
      return NextResponse.json(
        { error: 'Artigo não encontrado' },
        { status: 404 }
      );
    }

    // Gera recomendações
    const relatedNumbers = getRelatedArticles(numero, limit);

    // Mapeia com detalhes dos artigos
    const recommendations = relatedNumbers.map(num => {
      const article = LEI_14133_ARTIGOS[num];
      return {
        numero: num,
        ementa: article.ementa,
        capitulo: article.capitulo,
        secao: article.secao || null,
      };
    });

    return NextResponse.json({
      sourceArticle: numero,
      total: recommendations.length,
      recommendations
    });
  } catch (error) {
    console.error('Erro ao gerar recomendações:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar recomendações' },
      { status: 500 }
    );
  }
}
