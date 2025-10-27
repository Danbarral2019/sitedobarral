import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/depoimentos
 * Lista depoimentos (com filtro por status)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where = status ? { status } : {};

    const testimonials = await prisma.testimonial.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      testimonials,
      count: testimonials.length,
    });
  } catch (error) {
    console.error('Erro ao buscar depoimentos:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar depoimentos' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/depoimentos
 * Atualiza status de um depoimento (aprovar/rejeitar)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json(
        { error: 'ID e status são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      );
    }

    const testimonial = await prisma.testimonial.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      testimonial,
    });
  } catch (error) {
    console.error('Erro ao atualizar depoimento:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar depoimento' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/depoimentos
 * Deleta um depoimento
 */
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    await prisma.testimonial.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Depoimento deletado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar depoimento:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar depoimento' },
      { status: 500 }
    );
  }
}
