import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { Prisma } from '@prisma/client';
// GET /api/faq - Listar todas as FAQs publicadas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    // Construir filtros
    const where: Prisma.FAQWhereInput = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    // Buscar FAQs
    const faqs = await prisma.fAQ.findMany({
      where,
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
        // Depois por ordem de exibição
        { displayOrder: 'asc' },
        // Por fim, por data de criação
        { createdAt: 'desc' },
      ],
    });

    // Buscar todas as categorias disponíveis
    const allFaqs = await prisma.fAQ.findMany({
      where: { isPublished: true },
      select: { category: true },
    });

    const categories = [...new Set(allFaqs.map((f) => f.category))].sort();

    return NextResponse.json({
      faqs,
      total: faqs.length,
      categories,
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar perguntas frequentes' },
      { status: 500 }
    );
  }
}
