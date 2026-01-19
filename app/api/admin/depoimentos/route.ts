import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CacheInvalidation } from '@/lib/cache/redis-client';

/**
 * GET /api/admin/depoimentos
 * Lista depoimentos (com filtro por status)
 *
 * ✅ COM PAGINAÇÃO para performance
 *
 * Query params:
 * - status: string (approved/rejected/pending)
 * - page: number (padrão: 1)
 * - pageSize: number (padrão: 50, máx: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // ✅ Paginação
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));
    const skip = (page - 1) * pageSize;

    const where = status ? { status } : {};

    // ✅ Buscar com LIMITE
    const [testimonials, total] = await Promise.all([
      prisma.testimonial.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: pageSize,
        skip,
      }),
      prisma.testimonial.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      testimonials,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: skip + pageSize < total,
        hasPrev: page > 1,
      },
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

    // Invalidate testimonials cache (status change affects public visibility)
    await CacheInvalidation.testimonials();

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

    // Invalidate testimonials cache
    await CacheInvalidation.testimonials();

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
