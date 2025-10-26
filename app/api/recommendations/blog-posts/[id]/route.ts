import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRecommendations, ContentItem } from '@/lib/recommendations';

/**
 * GET /api/recommendations/blog-posts/[id]
 * Retorna posts recomendados baseado em um post específico
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '3');

    // Busca o post fonte
    const sourcePost = await prisma.blogPost.findUnique({
      where: { id }
    });

    if (!sourcePost) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    // Busca todos os posts publicados
    const candidatePosts = await prisma.blogPost.findMany({
      where: {
        isPublished: true,
        id: { not: id } // Exclui o próprio post
      },
      take: 50 // Limita candidatos
    });

    // Converte para ContentItem
    const sourceItem: ContentItem = {
      id: sourcePost.id,
      title: sourcePost.title,
      description: sourcePost.excerpt,
      tags: sourcePost.tags || undefined,
      leiArticles: sourcePost.leiArticles || undefined,
    };

    const candidateItems: ContentItem[] = candidatePosts.map(post => ({
      id: post.id,
      title: post.title,
      description: post.excerpt,
      tags: post.tags || undefined,
      leiArticles: post.leiArticles || undefined,
    }));

    // Gera recomendações
    const recommendations = generateRecommendations(sourceItem, candidateItems, limit);

    // Busca detalhes completos dos posts recomendados
    const recommendedPosts = await prisma.blogPost.findMany({
      where: {
        id: { in: recommendations.map(r => r.id) }
      }
    });

    // Mapeia recomendações com detalhes
    const result = recommendations.map(rec => {
      const post = recommendedPosts.find(p => p.id === rec.id);
      return {
        id: rec.id,
        title: rec.title,
        score: rec.score,
        reason: rec.reason,
        post: post ? {
          slug: post.slug,
          excerpt: post.excerpt,
          author: post.author,
          publishedAt: post.publishedAt,
        } : null
      };
    });

    return NextResponse.json({
      sourcePostId: id,
      total: result.length,
      recommendations: result
    });
  } catch (error) {
    console.error('Erro ao gerar recomendações:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar recomendações' },
      { status: 500 }
    );
  }
}
