import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSocialMediaStats } from '@/lib/social-publisher';

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
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
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
    console.error('Erro ao listar publicações sociais:', error);
    return NextResponse.json(
      {
        error: 'Erro ao carregar publicações',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
