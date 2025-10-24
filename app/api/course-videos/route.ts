import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Buscar vídeos do curso
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

    return NextResponse.json({ videos }, { status: 200 });
  } catch (error) {
    console.error('Erro ao buscar vídeos do curso:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar vídeos do curso' },
      { status: 500 }
    );
  }
}
