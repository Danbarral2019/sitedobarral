import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { publishToSocialMedia } from '@/lib/social-publisher';
import { handleApiError } from '@/lib/errors/error-handler';
import { ApiError, AuthenticationError, ValidationError } from '@/lib/errors/api-error';

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
      throw new AuthenticationError('Não autorizado');
    }

    const payload = await verifyToken(token);

    if (!payload || payload.role !== 'admin') {
      throw new AuthenticationError('Não autorizado');
    }

    // Obter dados do body
    const { blogPostId, platforms } = await request.json();

    if (!blogPostId) {
      throw new ValidationError('blogPostId é obrigatório');
    }

    // Publicar nas redes sociais
    const result = await publishToSocialMedia(
      blogPostId,
      platforms || ['instagram', 'linkedin']
    );

    if (!result.success) {
      // Falha de publicação nas plataformas: mantém o 500 e o resultado por
      // plataforma (agora em `details.results`).
      throw new ApiError(
        500,
        result.message || 'Erro ao publicar nas redes sociais',
        'SOCIAL_PUBLISH_FAILED',
        { results: result.results }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      results: result.results,
      imageUrl: result.imageUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
