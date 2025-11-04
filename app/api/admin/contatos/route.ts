import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';

/**
 * GET /api/admin/contatos
 * Lista mensagens de contato (com filtro por lidas/não lidas)
 *
 * ✅ COM PAGINAÇÃO para performance com muitos contatos
 *
 * Query params:
 * - unreadOnly: boolean (filtrar apenas não lidas)
 * - page: number (padrão: 1)
 * - pageSize: number (padrão: 50, máx: 100)
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // ✅ Paginação
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));
    const skip = (page - 1) * pageSize;

    const where = unreadOnly ? { isRead: false } : {};

    // ✅ Buscar com LIMITE (evita carregar milhares de contatos)
    const [contacts, total] = await Promise.all([
      prisma.contactForm.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
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
  } catch (error) {
    console.error('Erro ao buscar contatos:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar contatos' },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/contatos
 * Marca mensagem como lida/não lida
 */
export const PATCH = withAdminAuth(async (request: NextRequest) => {
  try {
    const { id, isRead } = await request.json();

    if (!id || typeof isRead !== 'boolean') {
      return NextResponse.json(
        { error: 'ID e isRead são obrigatórios' },
        { status: 400 }
      );
    }

    const contact = await prisma.contactForm.update({
      where: { id },
      data: { isRead },
    });

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error('Erro ao atualizar contato:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar contato' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/contatos
 * Deleta uma mensagem de contato
 */
export const DELETE = withAdminAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    await prisma.contactForm.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Contato deletado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar contato:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar contato' },
      { status: 500 }
    );
  }
});
