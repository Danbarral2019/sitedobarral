import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/errors/error-handler';

export const GET = withAdminAuth(async () => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Cards de saude
    const [activeUsers24h, loginsToday, loginsWeek, downloadsToday, downloadsWeek, registrosWeek] =
      await Promise.all([
        prisma.accessLog.findMany({
          where: { createdAt: { gte: twentyFourHoursAgo }, userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        }).then(r => r.length),
        prisma.accessLog.count({
          where: { action: 'login', createdAt: { gte: todayStart } },
        }),
        prisma.accessLog.count({
          where: { action: 'login', createdAt: { gte: weekAgo } },
        }),
        prisma.accessLog.count({
          where: { action: 'download', createdAt: { gte: todayStart } },
        }),
        prisma.accessLog.count({
          where: { action: 'download', createdAt: { gte: weekAgo } },
        }),
        prisma.user.count({
          where: { createdAt: { gte: weekAgo } },
        }),
      ]);

    // Atividade recente (ultimas 50)
    const recentActivity = await prisma.accessLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        userId: true,
        action: true,
        documentId: true,
        courseId: true,
        ip: true,
        createdAt: true,
      },
    });

    // Buscar nomes dos usuarios
    const userIds = [...new Set(recentActivity.map(a => a.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name || u.email || 'Anonimo']));

    // Grafico de atividade (ultimos 14 dias)
    const dailyActivity = await prisma.$queryRaw<
      Array<{ date: string; action: string; count: bigint }>
    >`
      SELECT
        DATE("createdAt") as date,
        action,
        COUNT(*) as count
      FROM "AccessLog"
      WHERE "createdAt" >= ${fourteenDaysAgo}
      GROUP BY DATE("createdAt"), action
      ORDER BY date ASC
    `;

    // Agrupar por dia
    const activityByDay: Record<string, { date: string; logins: number; downloads: number; views: number; access: number }> = {};
    for (const row of dailyActivity) {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      if (!activityByDay[dateStr]) {
        activityByDay[dateStr] = { date: dateStr, logins: 0, downloads: 0, views: 0, access: 0 };
      }
      const count = Number(row.count);
      if (row.action === 'login') activityByDay[dateStr].logins = count;
      else if (row.action === 'download') activityByDay[dateStr].downloads = count;
      else if (row.action === 'view') activityByDay[dateStr].views = count;
      else if (row.action === 'access') activityByDay[dateStr].access = count;
    }

    // Status dos scrapers (ultimo run de cada)
    const scraperHealth = await prisma.$queryRaw<
      Array<{
        scraperCode: string;
        status: string;
        itemsFound: number;
        itemsNew: number;
        itemsError: number;
        duration: number;
        errorMessage: string | null;
        runAt: Date;
      }>
    >`
      SELECT DISTINCT ON ("scraperCode")
        "scraperCode", status, "itemsFound", "itemsNew", "itemsError",
        duration, "errorMessage", "runAt"
      FROM "ScraperHealthLog"
      ORDER BY "scraperCode", "runAt" DESC
    `;

    return NextResponse.json({
      cards: {
        activeUsers24h,
        loginsToday,
        loginsWeek,
        downloadsToday,
        downloadsWeek,
        registrosWeek,
      },
      recentActivity: recentActivity.map(a => ({
        ...a,
        userName: a.userId ? userMap[a.userId] || 'Desconhecido' : 'Anonimo',
      })),
      dailyActivity: Object.values(activityByDay).sort((a, b) => a.date.localeCompare(b.date)),
      scraperHealth: scraperHealth.map(s => ({
        scraperCode: s.scraperCode,
        status: s.status,
        itemsFound: s.itemsFound,
        itemsNew: s.itemsNew,
        itemsError: s.itemsError,
        duration: s.duration,
        errorMessage: s.errorMessage,
        runAt: s.runAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
});
