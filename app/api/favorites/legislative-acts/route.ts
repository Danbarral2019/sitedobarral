import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getLeiArticles } from '@/lib/lei-articles';
import { handleApiError } from '@/lib/errors/error-handler';
import { AuthenticationError } from '@/lib/errors/api-error';

/**
 * GET /api/favorites/legislative-acts
 * Lista os atos normativos favoritos do usuário autenticado
 */
export async function GET() {
  try {
    // Verificar autenticação
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      throw new AuthenticationError('Não autenticado');
    }

    const payload = await verifyToken(token);
    if (!payload) {
      throw new AuthenticationError('Token inválido');
    }

    const userId = payload.userId as string;

    // Buscar favoritos de atos normativos do usuário
    const favorites = await prisma.favorite.findMany({
      where: {
        userId,
        legislativeActId: { not: null }
      },
      include: {
        // Não há relação direta, vamos buscar separadamente
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Buscar os atos normativos referenciados
    const actIds = favorites
      .map(f => f.legislativeActId)
      .filter((id): id is string => id !== null);

    const acts = await prisma.legislativeAct.findMany({
      where: {
        id: { in: actIds }
      }
    });

    // Mapear atos com data de adição aos favoritos
    const actsWithFavoriteData = acts.map(act => {
      const favorite = favorites.find(f => f.legislativeActId === act.id);
      return {
        ...act,
        leiArticles: getLeiArticles(act),
        favoritedAt: favorite?.createdAt
      };
    });

    // Ordenar por data de adição aos favoritos (mais recente primeiro)
    actsWithFavoriteData.sort((a, b) => {
      if (!a.favoritedAt || !b.favoritedAt) return 0;
      return new Date(b.favoritedAt).getTime() - new Date(a.favoritedAt).getTime();
    });

    return NextResponse.json({
      favorites: actsWithFavoriteData,
      count: actsWithFavoriteData.length
    });

  } catch (error) {
    return handleApiError(error);
  }
}
