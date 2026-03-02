import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';


// POST /api/access-log - Registrar um acesso/download
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { action, courseId, documentId } = body;

    if (!action) {
      return NextResponse.json({ error: 'action é obrigatório' }, { status: 400 });
    }

    // Captura IP e User Agent
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const accessLog = await prisma.accessLog.create({
      data: {
        userId: decoded.userId,
        action, // 'view', 'download', 'access'
        courseId: courseId || null,
        documentId: documentId || null,
        ip,
        userAgent,
      },
    });

    return NextResponse.json({ accessLog }, { status: 201 });
  } catch (error) {
    console.error('Erro ao registrar acesso:', error);
    return NextResponse.json({ error: 'Erro ao registrar acesso' }, { status: 500 });
  }
}

// GET /api/access-log - Listar histórico de acessos do usuário
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { userId: decoded.userId };
    if (courseId) where.courseId = courseId;
    if (action) where.action = action;

    const logs = await prisma.accessLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Erro ao listar acessos:', error);
    return NextResponse.json({ error: 'Erro ao listar acessos' }, { status: 500 });
  }
}
