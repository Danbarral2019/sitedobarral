import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { retryFailedPost } from '@/lib/social-publisher';
import { handleApiError } from '@/lib/errors/error-handler';
import { ApiError, AuthenticationError, ValidationError } from '@/lib/errors/api-error';

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
      throw new AuthenticationError('Não autorizado');
    }

    const payload = await verifyToken(token);

    if (!payload || payload.role !== 'admin') {
      throw new AuthenticationError('Não autorizado');
    }

    // Obter dados do body
    const { socialMediaPostId } = await request.json();

    if (!socialMediaPostId) {
      throw new ValidationError('socialMediaPostId é obrigatório');
    }

    // Tentar republicar
    const result = await retryFailedPost(socialMediaPostId);

    if (!result.success) {
      throw new ApiError(500, result.error || 'Erro ao republicar', 'SOCIAL_RETRY_FAILED');
    }

    return NextResponse.json({
      success: true,
      message: 'Post republicado com sucesso!',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
