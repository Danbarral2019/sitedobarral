import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, NotFoundError } from '@/lib/errors/api-error';

/**
 * POST /api/legislative-acts/[id]/favorite
 * Adiciona/remove ato normativo dos favoritos do usuário
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      throw new AuthenticationError('Não autenticado');
    }

    const payload = await verifyToken(token);
    if (!payload) {
      throw new AuthenticationError('Token inválido');
    }

    const userId = payload.userId as string;
    const { id: actId } = await params;

    // Verificar se o ato existe
    const act = await prisma.legislativeAct.findUnique({
      where: { id: actId }
    });

    if (!act) {
      throw new NotFoundError('Ato normativo');
    }

    // Verificar se já é favorito
    const existing = await prisma.favorite.findFirst({
      where: {
        userId,
        legislativeActId: actId
      }
    });

    if (existing) {
      // Remover dos favoritos
      await prisma.favorite.delete({
        where: { id: existing.id }
      });

      return NextResponse.json({
        success: true,
        action: 'removed',
        isFavorite: false
      });
    } else {
      // Adicionar aos favoritos
      await prisma.favorite.create({
        data: {
          userId,
          legislativeActId: actId,
          documentId: null, // Não é documento
          courseId: null    // Atos não têm curso
        }
      });

      return NextResponse.json({
        success: true,
        action: 'added',
        isFavorite: true
      });
    }

  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/legislative-acts/[id]/favorite
 * Verifica se o ato está nos favoritos do usuário
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ isFavorite: false });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ isFavorite: false });
    }

    const userId = payload.userId as string;
    const { id: actId } = await params;

    const favorite = await prisma.favorite.findFirst({
      where: {
        userId,
        legislativeActId: actId
      }
    });

    return NextResponse.json({
      isFavorite: !!favorite
    });

  } catch (error) {
    console.error('Erro ao verificar favorito:', error);
    return NextResponse.json({ isFavorite: false });
  }
}
