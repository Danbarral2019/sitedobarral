import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { getAcessoDoUsuario, podeVerDocumento } from '@/lib/search/acesso-documentos';

/** Teto do histórico devolvido pelo GET. */
const LIMITE_MAXIMO = 200;

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

    // Só entra no histórico documento que existe e que o usuário pode ver:
    // o recent-activity devolve título e url do que estiver aqui.
    if (documentId) {
      const doc = typeof documentId === 'string'
        ? await prisma.document.findUnique({
            where: { id: documentId },
            select: { isPublic: true, isCommon: true, courseId: true, category: true },
          })
        : null;
      if (!doc || !podeVerDocumento(doc, await getAcessoDoUsuario(decoded))) {
        throw new NotFoundError('Documento');
      }
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
    return handleApiError(error);
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
    const pedido = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, LIMITE_MAXIMO) : 50;

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
