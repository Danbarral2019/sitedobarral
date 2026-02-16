import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';

/**
 * GET /api/admin/search-analytics
 * Retorna analytics de buscas do assistente IA
 */
export const GET = withAdminAuth(async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Total de buscas
    const totalSearches = await prisma.searchHistory.count();
    const recentSearches = await prisma.searchHistory.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    // 2. Top 20 queries (agrupadas por texto, últimos 30 dias)
    const topQueries = await prisma.$queryRaw<
      Array<{ query: string; count: bigint; last_used: Date }>
    >`
      SELECT
        LOWER(TRIM(query)) as query,
        COUNT(*) as count,
        MAX("createdAt") as last_used
      FROM "SearchHistory"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY LOWER(TRIM(query))
      ORDER BY count DESC
      LIMIT 20
    `;

    // 3. Volume diário de buscas (últimos 30 dias)
    const dailyVolume = await prisma.$queryRaw<
      Array<{ date: string; count: bigint }>
    >`
      SELECT
        DATE("createdAt") as date,
        COUNT(*) as count
      FROM "SearchHistory"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // 4. Queries sem resposta IA (últimos 30 dias)
    const failedQueries = await prisma.searchHistory.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        aiAnswer: null,
      },
      select: {
        id: true,
        query: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 5. Queries muito curtas (< 3 caracteres, últimos 30 dias)
    const shortQueries = await prisma.$queryRaw<
      Array<{ query: string; count: bigint }>
    >`
      SELECT
        query,
        COUNT(*) as count
      FROM "SearchHistory"
      WHERE "createdAt" >= ${thirtyDaysAgo}
        AND LENGTH(TRIM(query)) < 3
      GROUP BY query
      ORDER BY count DESC
      LIMIT 20
    `;

    // 6. Top fontes citadas (parsear sources JSON)
    const sourcesRaw = await prisma.searchHistory.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        sources: { not: null },
      },
      select: {
        sources: true,
        legalSources: true,
      },
    });

    // Contar fontes
    const sourceCounter: Record<string, { title: string; count: number; type: string }> = {};
    for (const row of sourcesRaw) {
      // Parsear sources (documentos)
      if (row.sources) {
        try {
          const parsed = JSON.parse(row.sources);
          if (Array.isArray(parsed)) {
            for (const src of parsed) {
              const key = src.title || src.url || 'Desconhecido';
              if (!sourceCounter[key]) {
                sourceCounter[key] = { title: key, count: 0, type: src.category || 'documento' };
              }
              sourceCounter[key].count++;
            }
          }
        } catch { /* ignore parse errors */ }
      }
      // Parsear legalSources (atos normativos)
      if (row.legalSources) {
        try {
          const parsed = JSON.parse(row.legalSources);
          if (Array.isArray(parsed)) {
            for (const src of parsed) {
              const key = src.title || src.fullNumber || 'Desconhecido';
              if (!sourceCounter[key]) {
                sourceCounter[key] = { title: key, count: 0, type: src.type || 'legislacao' };
              }
              sourceCounter[key].count++;
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }

    const topSources = Object.values(sourceCounter)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // 7. Usuarios que mais buscam
    const topSearchUsers = await prisma.$queryRaw<
      Array<{ userId: string; count: bigint }>
    >`
      SELECT "userId", COUNT(*) as count
      FROM "SearchHistory"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY "userId"
      ORDER BY count DESC
      LIMIT 10
    `;

    // Buscar nomes dos usuarios
    const userIds = topSearchUsers.map(u => u.userId);
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const topUsersFormatted = topSearchUsers.map(u => {
      const user = users.find(usr => usr.id === u.userId);
      return {
        userId: u.userId,
        name: user?.name || 'Desconhecido',
        email: user?.email || '',
        count: Number(u.count),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        totalSearches,
        recentSearches,
        topQueries: topQueries.map(q => ({
          query: q.query,
          count: Number(q.count),
          lastUsed: q.last_used,
        })),
        dailyVolume: dailyVolume.map(d => ({
          date: d.date,
          count: Number(d.count),
        })),
        failedQueries: failedQueries.map(q => ({
          id: q.id,
          query: q.query,
          createdAt: q.createdAt,
        })),
        shortQueries: shortQueries.map(q => ({
          query: q.query,
          count: Number(q.count),
        })),
        topSources,
        topUsers: topUsersFormatted,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar search analytics:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar analytics de busca' },
      { status: 500 }
    );
  }
});
