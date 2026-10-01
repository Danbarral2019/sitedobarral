import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      throw new ValidationError('courseId is required');
    }

    const result = await withCache(
      CacheKeys.recommendedSites(courseId),
      async () => {
        const sitesToCourses = await prisma.siteToCourse.findMany({
          where: {
            courseId: courseId,
          },
          include: {
            site: true,
          },
        });

        const sites = sitesToCourses
          .filter(stc => stc.site.isActive)
          .sort((a, b) => a.site.displayOrder - b.site.displayOrder)
          .map(stc => ({
            id: stc.site.id,
            title: stc.site.title,
            description: stc.site.description,
            url: stc.site.url,
            faviconUrl: stc.site.faviconUrl,
            category: stc.site.category,
          }));

        return { sites };
      },
      CACHE_TTL.RECOMMENDED_SITES,
      { prefix: 'sites' }
    );

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
