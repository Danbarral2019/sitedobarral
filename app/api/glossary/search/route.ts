import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/glossary/search?q=termo - Buscar termos
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        terms: [],
        total: 0,
      });
    }

    const searchTerm = query.trim();

    // Buscar em term e definition
    const terms = await prisma.glossaryTerm.findMany({
      where: {
        isPublic: true,
        OR: [
          {
            term: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            definition: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            shortDef: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        term: true,
        slug: true,
        shortDef: true,
        category: true,
        viewCount: true,
      },
      orderBy: [
        // Termos que começam com a busca aparecem primeiro
        {
          term: 'asc',
        },
      ],
      take: 20,
    });

    return NextResponse.json({
      terms,
      total: terms.length,
      query: searchTerm,
    });
  } catch (error) {
    console.error('Error searching glossary:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar termos' },
      { status: 500 }
    );
  }
}
