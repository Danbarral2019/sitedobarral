import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/faq/[id]/view - Incrementar contador de visualizações
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Incrementar contador
    await prisma.fAQ.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      message: 'Visualização registrada',
    });
  } catch (error) {
    // Não retornar erro ao usuário - é apenas analytics
    console.error('Error incrementing FAQ view count:', error);
    return NextResponse.json({
      message: 'OK',
    });
  }
}
