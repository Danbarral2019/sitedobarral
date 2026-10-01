import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors/api-error';

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || !authResult.user) {
      throw new AuthenticationError('Unauthorized');
    }

    const history = await prisma.searchHistory.findMany({
      where: { userId: authResult.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ history });
  } catch (error) {
    return handleApiError(error);
  }
}

// Não há POST: o histórico é gravado pelo servidor na rota que gerou a
// resposta (/api/documents/query, /api/jurisprudencia/query), com
// `respostaDoServidor = true`. O POST antigo aceitava `aiAnswer`/`sources`
// do cliente, que depois podiam ser publicados por /busca/[shareId].

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);
    if (!authResult.valid || !authResult.user) {
      throw new AuthenticationError('Unauthorized');
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new ValidationError('ID is required');
    }

    // Verify ownership
    const entry = await prisma.searchHistory.findUnique({ where: { id } });
    if (!entry || entry.userId !== authResult.user.userId) {
      throw new NotFoundError('Registro');
    }

    await prisma.searchHistory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
