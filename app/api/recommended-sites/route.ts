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

    // Buscar sites recomendados para o curso
    const sitesToCourses = await prisma.siteToCourse.findMany({
      where: {
        courseId: courseId,
      },
      include: {
        site: true,
      },
    });

    // Filtrar apenas sites ativos, ordenar por displayOrder do site
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

    return NextResponse.json({ sites }, { status: 200 });
  } catch (error) {
    console.error('Erro ao buscar sites recomendados:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar sites recomendados' },
      { status: 500 }
    );
  }
}
