import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

/**
 * DELETE /api/newsletter/[id]
 * Deleta um inscrito da newsletter (apenas admin)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação de admin
    const authResult = await verifyAuth(request);

    if (!authResult.user || authResult.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Verificar se o inscrito existe
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { id },
    });

    if (!subscriber) {
      return NextResponse.json(
        { error: 'Inscrito não encontrado' },
        { status: 404 }
      );
    }

    // Deletar o inscrito
    await prisma.newsletterSubscriber.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Inscrito ${subscriber.email} deletado com sucesso`,
    });
  } catch (error) {
    console.error('Erro ao deletar inscrito da newsletter:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar inscrito' },
      { status: 500 }
    );
  }
}
