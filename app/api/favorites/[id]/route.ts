import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError, AuthenticationError, ValidationError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';

// PATCH /api/favorites/[id] - Atualizar anotação do favorito
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value || request.cookies.get('auth_token')?.value;
    if (!token) {
      throw new AuthenticationError();
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      throw new AuthenticationError();
    }

    const { id } = await params;
    const body = await request.json();
    const { annotation } = body;

    if (annotation !== null && annotation !== undefined && typeof annotation !== 'string') {
      throw new ValidationError('Anotação deve ser uma string');
    }

    if (typeof annotation === 'string' && annotation.length > 5000) {
      throw new ValidationError('Anotação não pode exceder 5000 caracteres');
    }

    // Verificar que o favorito pertence ao usuário
    const favorite = await prisma.favorite.findUnique({
      where: { id },
    });

    if (!favorite) {
      throw new NotFoundError('Favorito');
    }

    if (favorite.userId !== decoded.userId) {
      throw new NotFoundError('Favorito');
    }

    const updated = await prisma.favorite.update({
      where: { id },
      data: {
        annotation: annotation?.trim() || null,
      },
    });

    apiLogger.info({ favoriteId: id, userId: decoded.userId }, 'Favorite annotation updated');

    return NextResponse.json({ favorite: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
