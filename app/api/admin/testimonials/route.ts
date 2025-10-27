import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';


/**
 * GET /api/admin/testimonials
 * Lista todos os depoimentos (com filtro opcional por status)
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending, approved, rejected, all
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const testimonials = await prisma.testimonial.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // pending primeiro
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    const stats = {
      pending: await prisma.testimonial.count({ where: { status: 'pending' } }),
      approved: await prisma.testimonial.count({ where: { status: 'approved' } }),
      rejected: await prisma.testimonial.count({ where: { status: 'rejected' } }),
    };

    return NextResponse.json({
      success: true,
      testimonials,
      stats,
    });
  } catch (error) {
    console.error('Erro ao listar testimonials:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar depoimentos' },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/testimonials
 * Atualiza um depoimento (aprovar, reprovar, editar)
 */
export const PATCH = withAdminAuth(async (request: NextRequest) => {
  try {
    console.log('[API Testimonials] Recebendo PATCH request');
    const body = await request.json();
    console.log('[API Testimonials] Body:', body);
    const { id, action, data } = body;

    if (!id) {
      console.log('[API Testimonials] Erro: ID não fornecido');
      return NextResponse.json(
        { error: 'ID do depoimento é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar o testimonial
    console.log('[API Testimonials] Buscando depoimento:', id);
    const testimonial = await prisma.testimonial.findUnique({
      where: { id },
    });

    if (!testimonial) {
      console.log('[API Testimonials] Depoimento não encontrado:', id);
      return NextResponse.json(
        { error: 'Depoimento não encontrado' },
        { status: 404 }
      );
    }

    console.log('[API Testimonials] Depoimento encontrado, action:', action);

    let updateData: Record<string, unknown> = {};

    if (action === 'approve') {
      updateData = {
        status: 'approved',
        moderatedAt: new Date(),
        // moderatedBy pode ser preenchido quando tiver auth context
      };
    } else if (action === 'reject') {
      updateData = {
        status: 'rejected',
        moderatedAt: new Date(),
        rejectionReason: data?.rejectionReason || null,
      };
    } else if (action === 'edit') {
      // Permite editar campos antes de aprovar
      const allowedFields = ['name', 'role', 'text', 'rating', 'avatar', 'color'];
      updateData = {};
      for (const field of allowedFields) {
        if (data && field in data) {
          updateData[field] = data[field];
        }
      }
    } else {
      return NextResponse.json(
        { error: 'Ação inválida. Use: approve, reject ou edit' },
        { status: 400 }
      );
    }

    console.log('[API Testimonials] Atualizando com dados:', updateData);
    const updated = await prisma.testimonial.update({
      where: { id },
      data: updateData,
    });

    console.log('[API Testimonials] Depoimento atualizado com sucesso');
    return NextResponse.json({
      success: true,
      testimonial: updated,
    });
  } catch (error) {
    console.error('[API Testimonials] Erro ao atualizar testimonial:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar depoimento' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/testimonials
 * Deleta um depoimento
 */
export const DELETE = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID do depoimento é obrigatório' },
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
    console.error('Erro ao deletar testimonial:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar depoimento' },
      { status: 500 }
    );
  }
});
