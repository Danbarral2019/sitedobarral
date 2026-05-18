import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { apiLogger } from "@/lib/logger";

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
    const user = await getCurrentUser();

    if (!user || user.role !== 'admin') {
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
    apiLogger.error({ err: error }, 'Erro ao deletar inscrito da newsletter:');
    return NextResponse.json(
      { error: 'Erro ao deletar inscrito' },
      { status: 500 }
    );
  }
}
