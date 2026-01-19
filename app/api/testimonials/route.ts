import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

/**
 * GET /api/testimonials
 * Retorna apenas depoimentos aprovados (para exibição pública)
 */
export async function GET() {
  try {
    // Generate cache key (single key, no filters)
    const cacheKey = CacheKeys.testimonialsList();

    // Use cached result or fetch from database
    const result = await withCache(
      cacheKey,
      async () => {
        const testimonials = await prisma.testimonial.findMany({
          where: {
            status: 'approved',
          },
          select: {
            id: true,
            name: true,
            role: true,
            text: true,
            rating: true,
            avatar: true,
            color: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        return {
          success: true,
          testimonials,
        };
      },
      CACHE_TTL.TESTIMONIALS
      // No prefix needed - single key, direct invalidation
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao buscar testimonials:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar depoimentos' },
      { status: 500 }
    );
  }
}
