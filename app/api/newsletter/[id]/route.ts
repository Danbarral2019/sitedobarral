import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, NotFoundError } from '@/lib/errors/api-error';

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
      throw new AuthenticationError('Não autorizado');
    }

    const { id } = await context.params;

    // Verificar se o inscrito existe
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { id },
    });

    if (!subscriber) {
      throw new NotFoundError('Inscrito');
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
    return handleApiError(error);
  }
}
