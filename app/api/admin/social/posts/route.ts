import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSocialMediaStats } from '@/lib/social-publisher';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError } from '@/lib/errors/api-error';

/**
 * GET /api/admin/social/posts
 *
 * Lista todas as publicações em redes sociais
 */
export async function GET(request: NextRequest) {
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

    // Obter filtros da query
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');

    // Construir where clause
    const where: Record<string, unknown> = {};
    if (platform) where.platform = platform;
    if (status) where.status = status;

    // Buscar publicações
    const posts = await prisma.socialMediaPost.findMany({
      where,
      include: {
        blogPost: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limitar a 100 resultados
    });

    // Obter estatísticas
    const stats = await getSocialMediaStats();

    return NextResponse.json({
      posts,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
