import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CacheInvalidation } from '@/lib/cache/redis-client';
import { withAdminApi } from '@/lib/api/handler';
import { handleApiError } from '@/lib/errors/error-handler';
import { ValidationError } from '@/lib/errors/api-error';

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
export const GET = withAdminApi(async (request: NextRequest) => {
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
    return handleApiError(error);
  }
});

/**
 * POST /api/admin/depoimentos
 * Cria um novo depoimento (admin)
 */
export const POST = withAdminApi(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { name, email, phone, role, text, rating, avatar, color, status } = body;

    if (!name || !email || !role || !text) {
      throw new ValidationError('Nome, email, cargo e texto são obrigatórios');
    }

    const testimonial = await prisma.testimonial.create({
      data: {
        name,
        email,
        phone: phone || null,
        role,
        text,
        rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
        avatar: avatar || name.charAt(0).toUpperCase(),
        color: color || 'from-blue-400 to-blue-600',
        status: status || 'pending',
      },
    });

    await CacheInvalidation.testimonials();

    return NextResponse.json({ success: true, testimonial }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * PATCH /api/admin/depoimentos
 * Atualiza status de um depoimento (aprovar/rejeitar)
 */
export const PATCH = withAdminApi(async (request: NextRequest) => {
  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      throw new ValidationError('ID e status são obrigatórios');
    }

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      throw new ValidationError('Status inválido');
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
    return handleApiError(error);
  }
});

/**
 * DELETE /api/admin/depoimentos
 * Deleta um depoimento
 */
export const DELETE = withAdminApi(async (request: NextRequest) => {
  try {
    const { id } = await request.json();

    if (!id) {
      throw new ValidationError('ID é obrigatório');
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
    return handleApiError(error);
  }
});
