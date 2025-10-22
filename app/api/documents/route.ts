import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: string;
  role: string;
}

export async function GET(request: NextRequest) {
  try {
    // Obter token do cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Buscar usuário com matrículas
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { enrollments: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Obter courseId do query
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId é obrigatório' },
        { status: 400 }
      );
    }

    // Se for admin, pode ver todos os documentos
    if (user.role === 'admin') {
      const documents = await prisma.document.findMany({
        where: { courseId },
        orderBy: { uploadedAt: 'desc' },
      });

      return NextResponse.json({ documents });
    }

    // Para alunos, verificar se está matriculado
    const isEnrolled = user.enrollments.some(e => e.courseId === courseId);

    if (!isEnrolled) {
      return NextResponse.json(
        { error: 'Você não está matriculado neste curso' },
        { status: 403 }
      );
    }

    // Buscar documentos do curso (públicos + restritos já que está matriculado)
    const documents = await prisma.document.findMany({
      where: { courseId },
      orderBy: { uploadedAt: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Erro ao buscar documentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documentos' },
      { status: 500 }
    );
  }
}
