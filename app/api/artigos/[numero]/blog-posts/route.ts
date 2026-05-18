import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { apiLogger } from "@/lib/logger";

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

    const result = await withCache(
      CacheKeys.articleDetails(numero, 'blog'),
      async () => {
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
          take: 20
        });

        const mappedPosts = posts.map(post => ({
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          author: post.author,
          publishedAt: post.publishedAt,
        }));

        return {
          articleNumber: numero,
          total: mappedPosts.length,
          posts: mappedPosts
        };
      },
      CACHE_TTL.BLOG_POSTS,
      { prefix: 'article' }
    );

    return NextResponse.json(result);
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao buscar posts do artigo:');
    return NextResponse.json(
      { error: 'Erro ao buscar posts' },
      { status: 500 }
    );
  }
}
