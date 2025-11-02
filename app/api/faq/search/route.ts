import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/faq/search?q=termo - Buscar em perguntas e respostas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        faqs: [],
        total: 0,
      });
    }

    const searchTerm = query.trim();

    // Buscar em question e answer
    const faqs = await prisma.fAQ.findMany({
      where: {
        isPublished: true,
        OR: [
          {
            question: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            answer: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            keywords: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        isPinned: true,
        viewCount: true,
        helpfulCount: true,
        notHelpfulCount: true,
      },
      orderBy: [
        // Perguntas fixadas primeiro
        { isPinned: 'desc' },
        // Mais visualizadas
        { viewCount: 'desc' },
      ],
      take: 20,
    });

    return NextResponse.json({
      faqs,
      total: faqs.length,
      query: searchTerm,
    });
  } catch (error) {
    console.error('Error searching FAQs:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar perguntas' },
      { status: 500 }
    );
  }
}
