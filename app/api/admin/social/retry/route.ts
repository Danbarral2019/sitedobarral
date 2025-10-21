import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { retryFailedPost } from '@/lib/social-publisher';

/**
 * POST /api/admin/social/retry
 *
 * Tenta republicar um post que falhou
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Obter dados do body
    const { socialMediaPostId } = await request.json();

    if (!socialMediaPostId) {
      return NextResponse.json(
        { error: 'socialMediaPostId é obrigatório' },
        { status: 400 }
      );
    }

    // Tentar republicar
    const result = await retryFailedPost(socialMediaPostId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erro ao republicar' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Post republicado com sucesso!',
    });
  } catch (error) {
    console.error('Erro ao republicar:', error);
    return NextResponse.json(
      {
        error: 'Erro ao processar republicação',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
