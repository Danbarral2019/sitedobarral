import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';

/**
 * GET /api/admin/analytics/charts
 * Retorna dados para gráficos (lazy loading)
 */
export const GET = withAdminAuth(async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Acessos por dia (últimos 30 dias)
    const accessLogs = await prisma.accessLog.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
      },
    });

    // Agrupar por dia
    const accessByDay: Record<string, number> = {};
    accessLogs.forEach(log => {
      const date = log.createdAt.toISOString().split('T')[0];
      accessByDay[date] = (accessByDay[date] || 0) + 1;
    });

    const accessByDayArray = Object.entries(accessByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Estatísticas por ação
    const actionStats = await prisma.accessLog.groupBy({
      by: ['action'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const actionStatsFormatted = actionStats.map(item => ({
      action: item.action,
      count: item._count.id,
    }));

    return NextResponse.json({
      accessByDay: accessByDayArray,
      actionStats: actionStatsFormatted,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
      },
    });
  } catch (error) {
    console.error('[Analytics Charts] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados de gráficos' },
      { status: 500 }
    );
  }
});
