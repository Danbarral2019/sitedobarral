import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const sites = await prisma.recommendedSite.findMany({
      include: {
        courses: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    return NextResponse.json({ sites });
  } catch (error) {
    console.error('Erro ao listar sites:', error);
    return NextResponse.json({ error: 'Erro ao listar sites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, url, category, courseIds } = body;

    // Obter favicon
    const faviconUrl = getFaviconUrl(url);

    // Criar site
    const site = await prisma.recommendedSite.create({
      data: {
        title,
        description,
        url,
        category: category || null,
        faviconUrl,
        isActive: true,
        displayOrder: 0,
      },
    });

    // Vincular aos cursos
    if (courseIds && courseIds.length > 0) {
      await Promise.all(
        courseIds.map((courseId: string, index: number) =>
          prisma.siteToCourse.create({
            data: {
              siteId: site.id,
              courseId,
              displayOrder: index,
            },
          })
        )
      );
    }

    return NextResponse.json({ site }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar site:', error);
    return NextResponse.json({ error: 'Erro ao criar site' }, { status: 500 });
  }
}

function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
  } catch {
    return '';
  }
}
