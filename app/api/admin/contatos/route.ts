import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';

/**
 * GET /api/admin/contatos
 * Lista mensagens de contato (com filtro por lidas/não lidas)
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where = unreadOnly ? { read: false } : {};

    const contacts = await prisma.contactForm.findMany({
      where,
      orderBy: {
        submittedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      contacts,
      count: contacts.length,
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
    const { id, read } = await request.json();

    if (!id || typeof read !== 'boolean') {
      return NextResponse.json(
        { error: 'ID e read são obrigatórios' },
        { status: 400 }
      );
    }

    const contact = await prisma.contactForm.update({
      where: { id },
      data: { read },
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
