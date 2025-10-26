import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/artigos/[numero]/blog-posts
 * Retorna posts do blog relacionados a um artigo específico da Lei 14.133/2021
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero } = await context.params;

    // Valida número do artigo
    const articleNum = parseInt(numero);
    if (isNaN(articleNum) || articleNum < 1 || articleNum > 193) {
      return NextResponse.json(
        { error: 'Número de artigo inválido' },
        { status: 400 }
      );
    }

    // Busca posts publicados que contêm este artigo
    const posts = await prisma.blogPost.findMany({
      where: {
        isPublished: true,
        leiArticles: {
          contains: `"${numero}"`
        }
      },
      orderBy: {
        publishedAt: 'desc'
      },
      take: 20 // Limita a 20 posts
    });

    // Mapeia posts para formato de resposta
    const mappedPosts = posts.map(post => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      author: post.author,
      publishedAt: post.publishedAt,
    }));

    return NextResponse.json({
      articleNumber: numero,
      total: mappedPosts.length,
      posts: mappedPosts
    });
  } catch (error) {
    console.error('Erro ao buscar posts do artigo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar posts' },
      { status: 500 }
    );
  }
}
