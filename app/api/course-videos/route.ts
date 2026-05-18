import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';
import { apiLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId is required' },
        { status: 400 }
      );
    }

    const result = await withCache(
      CacheKeys.courseVideos(courseId),
      async () => {
        const videos = await prisma.courseVideo.findMany({
          where: {
            courseId: courseId,
            isActive: true,
          },
          orderBy: {
            displayOrder: 'asc',
          },
          select: {
            id: true,
            title: true,
            description: true,
            youtubeUrl: true,
            youtubeId: true,
            thumbnailUrl: true,
          },
        });
        return { videos };
      },
      CACHE_TTL.COURSE_VIDEOS,
      { prefix: 'videos' }
    );

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao buscar vídeos do curso:');
    return NextResponse.json(
      { error: 'Erro ao buscar vídeos do curso' },
      { status: 500 }
    );
  }
}
