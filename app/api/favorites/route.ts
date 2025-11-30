import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';


// GET /api/favorites - Listar favoritos do usuário
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value || request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
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
    });

    return NextResponse.json({ favorites });
  } catch (error) {
    console.error('Erro ao listar favoritos:', error);
    return NextResponse.json({ error: 'Erro ao listar favoritos' }, { status: 500 });
  }
}

// POST /api/favorites - Adicionar favorito
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value || request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, courseId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId é obrigatório' },
        { status: 400 }
      );
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
    console.error('Erro ao adicionar favorito:', error);
    return NextResponse.json({ error: 'Erro ao adicionar favorito' }, { status: 500 });
  }
}

// DELETE /api/favorites - Remover favorito
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value || request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId é obrigatório' }, { status: 400 });
    }

    await prisma.favorite.deleteMany({
      where: {
        userId: decoded.userId,
        documentId,
      },
    });

    return NextResponse.json({ message: 'Favorito removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover favorito:', error);
    return NextResponse.json({ error: 'Erro ao remover favorito' }, { status: 500 });
  }
}
