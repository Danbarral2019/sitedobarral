import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/testimonials
 * Retorna apenas depoimentos aprovados (para exibição pública)
 */
export async function GET() {
  try {
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

    return NextResponse.json({
      success: true,
      testimonials,
    });
  } catch (error) {
    console.error('Erro ao buscar testimonials:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar depoimentos' },
      { status: 500 }
    );
  }
}
