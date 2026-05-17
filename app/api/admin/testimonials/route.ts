import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError, NotFoundError } from '@/lib/errors/api-error';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/testimonials
 * Lista todos os depoimentos (com filtro opcional por status)
 */
export const GET = withAdminApi(async (request: NextRequest) => {
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
});

/**
 * PATCH /api/admin/testimonials
 * Atualiza um depoimento (aprovar, reprovar, editar)
 */
export const PATCH = withAdminApi(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { id, action, data } = body;

  if (!id) {
    throw new ValidationError('ID do depoimento é obrigatório');
  }

  // Buscar o testimonial
  const testimonial = await prisma.testimonial.findUnique({
    where: { id },
  });

  if (!testimonial) {
    throw new NotFoundError('Depoimento');
  }

  ctx.logger.info({ id, action }, 'Atualizando testimonial');

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
    throw new ValidationError('Ação inválida. Use: approve, reject ou edit');
  }

  const updated = await prisma.testimonial.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    testimonial: updated,
  });
});

/**
 * DELETE /api/admin/testimonials
 * Deleta um depoimento
 */
export const DELETE = withAdminApi(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    throw new ValidationError('ID do depoimento é obrigatório');
  }

  await prisma.testimonial.delete({
    where: { id },
  });

  return NextResponse.json({
    success: true,
    message: 'Depoimento deletado com sucesso',
  });
});
