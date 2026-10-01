import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError, ValidationError } from '@/lib/errors/api-error';


// GET /api/favorites - Listar favoritos do usuário
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value || request.cookies.get('auth_token')?.value;

    if (!token) {
      throw new AuthenticationError('Não autorizado');
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      throw new AuthenticationError('Token inválido');
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    const where: Record<string, unknown> = { userId: decoded.userId };
    if (courseId) {
      where.courseId = courseId;
    }

    const favorites = await prisma.favorite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ favorites });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/favorites - Adicionar favorito
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value || request.cookies.get('auth_token')?.value;

    if (!token) {
      throw new AuthenticationError('Não autorizado');
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      throw new AuthenticationError('Token inválido');
    }

    const body = await request.json();
    const { documentId, courseId } = body;

    if (!documentId) {
      throw new ValidationError('documentId é obrigatório');
    }

    // Verifica se já existe
    const existing = await prisma.favorite.findFirst({
      where: {
        userId: decoded.userId,
        documentId,
      },
    });

    if (existing) {
      return NextResponse.json({ message: 'Já está nos favoritos', favorite: existing });
    }

    // Cria novo favorito
    const favorite = await prisma.favorite.create({
      data: {
        userId: decoded.userId,
        documentId,
        courseId: courseId || null,
      },
    });

    return NextResponse.json({ favorite }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/favorites - Remover favorito
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value || request.cookies.get('auth_token')?.value;

    if (!token) {
      throw new AuthenticationError('Não autorizado');
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      throw new AuthenticationError('Token inválido');
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      throw new ValidationError('documentId é obrigatório');
    }

    await prisma.favorite.deleteMany({
      where: {
        userId: decoded.userId,
        documentId,
      },
    });

    return NextResponse.json({ message: 'Favorito removido com sucesso' });
  } catch (error) {
    return handleApiError(error);
  }
}
