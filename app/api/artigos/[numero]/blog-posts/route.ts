import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';

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
      throw new ValidationError('Número de artigo inválido');
    }

    const result = await withCache(
      CacheKeys.articleDetails(numero, 'blog'),
      async () => {
        const posts = await prisma.blogPost.findMany({
          where: {
            isPublished: true,
            leiArticlesArr: {
              has: numero
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
    return handleApiError(error);
  }
}
