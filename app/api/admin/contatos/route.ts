import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';

/**
 * GET /api/admin/contatos
 * Lista mensagens de contato (com filtro por lidas/não lidas)
 *
 * Query params:
 * - unreadOnly: boolean (filtrar apenas não lidas)
 * - page: number (padrão: 1)
 * - pageSize: number (padrão: 50, máx: 100)
 */
export const GET = withAdminApi(async (request) => {
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));
  const skip = (page - 1) * pageSize;

  const where = unreadOnly ? { isRead: false } : {};

  const [contacts, total] = await Promise.all([
    prisma.contactForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip,
    }),
    prisma.contactForm.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    contacts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: skip + pageSize < total,
      hasPrev: page > 1,
    },
  });
});

/**
 * PATCH /api/admin/contatos
 * Marca mensagem como lida/não lida
 */
export const PATCH = withAdminApi(async (request) => {
  const { id, isRead } = await request.json();

  if (!id || typeof isRead !== 'boolean') {
    throw new ValidationError('ID e isRead são obrigatórios');
  }

  const contact = await prisma.contactForm.update({
    where: { id },
    data: { isRead },
  });

  return NextResponse.json({
    success: true,
    contact,
  });
});

/**
 * DELETE /api/admin/contatos
 * Deleta uma mensagem de contato
 */
export const DELETE = withAdminApi(async (request) => {
  const { id } = await request.json();

  if (!id) {
    throw new ValidationError('ID é obrigatório');
  }

  await prisma.contactForm.delete({
    where: { id },
  });

  return NextResponse.json({
    success: true,
    message: 'Contato deletado com sucesso',
  });
});
