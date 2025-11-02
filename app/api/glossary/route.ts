import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { Prisma } from '@prisma/client';
// GET /api/glossary - Listar todos os termos (com filtros opcionais)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const letter = searchParams.get('letter');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Construir filtros
    const where: Prisma.GlossaryTermWhereInput = {
      isPublic: true,
    };

    if (category) {
      where.category = category;
    }

    if (letter) {
      where.term = {
        startsWith: letter.toUpperCase(),
      };
    }

    // Buscar termos
    const [terms, total] = await Promise.all([
      prisma.glossaryTerm.findMany({
        where,
        select: {
          id: true,
          term: true,
          slug: true,
          definition: true,
          shortDef: true,
          category: true,
          viewCount: true,
          leiArticles: true,
          relatedTerms: true,
        },
        orderBy: {
          term: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.glossaryTerm.count({ where }),
    ]);

    // Buscar todas as categorias disponíveis
    const allTerms = await prisma.glossaryTerm.findMany({
      where: { isPublic: true },
      select: { category: true },
    });

    const categories = [...new Set(allTerms.map((t) => t.category).filter(Boolean))].sort();

    return NextResponse.json({
      terms,
      total,
      categories,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching glossary terms:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar termos do glossário' },
      { status: 500 }
    );
  }
}
