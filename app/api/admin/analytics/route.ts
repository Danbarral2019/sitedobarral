import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';


/**
 * GET /api/admin/analytics
 * Retorna métricas agregadas para o dashboard do admin
 */
export const GET = withAdminAuth(async () => {
  try {
    // 1. Estatísticas de Usuários
    const totalUsers = await prisma.user.count();
    const totalStudents = await prisma.user.count({
      where: { role: 'student' },
    });
    const totalAdmins = await prisma.user.count({
      where: { role: 'admin' },
    });

    // 2. Estatísticas de Matrículas
    const totalEnrollments = await prisma.enrollment.count();
    const activeEnrollments = await prisma.enrollment.count({
      where: {
        OR: [
          { isLifetime: true },
          { expiresAt: { gte: new Date() } },
        ],
      },
    });
    const expiredEnrollments = await prisma.enrollment.count({
      where: {
        isLifetime: false,
        expiresAt: { lt: new Date() },
      },
    });
    const lifetimeEnrollments = await prisma.enrollment.count({
      where: { isLifetime: true },
    });

    // 3. Estatísticas de Documentos
    const totalDocuments = await prisma.document.count();
    const publicDocuments = await prisma.document.count({
      where: { isPublic: true },
    });
    const privateDocuments = await prisma.document.count({
      where: { isPublic: false },
    });

    // 4. Documentos mais acessados (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let topDocumentsWithDetails: Array<{
      id: string;
      title: string;
      type: string;
      category: string;
      accessCount: number;
    } | null> = [];

    try {
      const topDocuments = await prisma.accessLog.groupBy({
        by: ['documentId'],
        where: {
          documentId: { not: null },
          action: { in: ['download', 'view'] },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      });

      // Buscar detalhes dos documentos mais acessados (OTIMIZADO - 1 query em vez de N)
      const documentIds = topDocuments
        .map(item => item.documentId)
        .filter((id): id is string => id !== null);

      const documents = await prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: {
          id: true,
          title: true,
          type: true,
          category: true,
        },
      });

      // Mapear resultados de volta
      topDocumentsWithDetails = topDocuments.map(item => {
        if (!item.documentId) return null;
        const document = documents.find(d => d.id === item.documentId);
        return document ? {
          ...document,
          accessCount: item._count.id,
        } : null;
      });
    } catch (error) {
      console.error('Erro ao buscar documentos mais acessados:', error);
    }

    // 5. Cursos com mais acessos (últimos 30 dias)
    let topCoursesData: Array<{ courseId: string | null; accessCount: number }> = [];
    try {
      const topCourses = await prisma.accessLog.groupBy({
        by: ['courseId'],
        where: {
          courseId: { not: null },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      });

      topCoursesData = topCourses.map(item => ({
        courseId: item.courseId,
        accessCount: item._count.id,
      }));
    } catch (error) {
      console.error('Erro ao buscar cursos mais acessados:', error);
    }

    // 6. Acessos por dia (últimos 30 dias)
    let accessByDayFormatted: Array<{ date: string; count: number }> = [];
    try {
      const accessByDay = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE("createdAt") as date,
          COUNT(*) as count
        FROM "AccessLog"
        WHERE "createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `;

      accessByDayFormatted = accessByDay.map(item => ({
        date: item.date,
        count: Number(item.count),
      }));
    } catch (error) {
      console.error('Erro ao buscar acessos por dia:', error);
      // Continua sem os dados de acessos por dia
    }

    // 7. Usuários mais ativos (últimos 30 dias)
    let topUsersWithDetails: Array<{
      id: string;
      name: string | null;
      email: string;
      accessCount: number;
    } | null> = [];

    try {
      const topUsers = await prisma.accessLog.groupBy({
        by: ['userId'],
        where: {
          userId: { not: null },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      });

      // Buscar detalhes dos usuários mais ativos (OTIMIZADO - 1 query em vez de N)
      const userIds = topUsers
        .map(item => item.userId)
        .filter((id): id is string => id !== null);

      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      // Mapear resultados de volta
      topUsersWithDetails = topUsers.map(item => {
        if (!item.userId) return null;
        const user = users.find(u => u.id === item.userId);
        return user ? {
          ...user,
          accessCount: item._count.id,
        } : null;
      });
    } catch (error) {
      console.error('Erro ao buscar usuários mais ativos:', error);
    }

    // 8. Estatísticas de Ações (últimos 30 dias)
    let actionStatsFormatted: Array<{ action: string; count: number }> = [];
    try {
      const actionStats = await prisma.accessLog.groupBy({
        by: ['action'],
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: {
          id: true,
        },
      });

      actionStatsFormatted = actionStats.map(item => ({
        action: item.action,
        count: item._count.id,
      }));
    } catch (error) {
      console.error('Erro ao buscar estatísticas de ações:', error);
    }

    // 9. Total de acessos (últimos 30 dias)
    let totalAccesses = 0;
    try {
      totalAccesses = await prisma.accessLog.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
      });
    } catch (error) {
      console.error('Erro ao contar total de acessos:', error);
    }

    // 10. Blog Posts
    const totalBlogPosts = await prisma.blogPost.count();
    const publishedBlogPosts = await prisma.blogPost.count({
      where: { isPublished: true },
    });

    // 11. QR Codes
    const totalQRCodes = await prisma.qRCode.count();
    const activeQRCodes = await prisma.qRCode.count({
      where: {
        validUntil: { gte: new Date() },
      },
    });

    // 12. Newsletter
    const totalNewsletterSubscribers = await prisma.newsletterSubscriber.count();
    const activeNewsletterSubscribers = await prisma.newsletterSubscriber.count({
      where: { isActive: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          students: totalStudents,
          admins: totalAdmins,
        },
        enrollments: {
          total: totalEnrollments,
          active: activeEnrollments,
          expired: expiredEnrollments,
          lifetime: lifetimeEnrollments,
          renewalRate: totalEnrollments > 0
            ? ((activeEnrollments / totalEnrollments) * 100).toFixed(1)
            : '0',
        },
        documents: {
          total: totalDocuments,
          public: publicDocuments,
          private: privateDocuments,
        },
        topDocuments: topDocumentsWithDetails.filter(doc => doc !== null),
        topCourses: topCoursesData,
        topUsers: topUsersWithDetails.filter(user => user !== null),
        accessByDay: accessByDayFormatted,
        actionStats: actionStatsFormatted,
        totalAccesses,
        blog: {
          total: totalBlogPosts,
          published: publishedBlogPosts,
        },
        qrCodes: {
          total: totalQRCodes,
          active: activeQRCodes,
        },
        newsletter: {
          total: totalNewsletterSubscribers,
          active: activeNewsletterSubscribers,
        },
      },
    });
  } catch (error) {
    console.error('Erro ao buscar analytics:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
});
