import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/favorites/legislative-acts
 * Lista os atos normativos favoritos do usuário autenticado
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
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
        leiArticles: act.leiArticles ? JSON.parse(act.leiArticles) : [],
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
    console.error('Erro ao buscar favoritos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar favoritos' },
      { status: 500 }
    );
  }
}
