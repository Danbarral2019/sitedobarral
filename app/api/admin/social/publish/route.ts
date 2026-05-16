import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { publishToSocialMedia } from '@/lib/social-publisher';
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/admin/social/publish
 *
 * Publica um post do blog nas redes sociais
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
    const { blogPostId, platforms } = await request.json();

    if (!blogPostId) {
      return NextResponse.json(
        { error: 'blogPostId é obrigatório' },
        { status: 400 }
      );
    }

    // Publicar nas redes sociais
    const result = await publishToSocialMedia(
      blogPostId,
      platforms || ['instagram', 'linkedin']
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.message || 'Erro ao publicar nas redes sociais',
          results: result.results,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      results: result.results,
      imageUrl: result.imageUrl,
    });
  } catch (error) {
    apiLogger.error({ err: error }, 'Erro ao publicar nas redes sociais:');
    return NextResponse.json(
      {
        error: 'Erro ao processar publicação',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
