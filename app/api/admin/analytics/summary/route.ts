import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/api-middleware';
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/admin/analytics/summary
 * Retorna apenas métricas principais (carregamento rápido)
 */
export const GET = withAdminAuth(async () => {
  try {
    // Executar queries em paralelo para otimizar
    const [
      totalUsers,
      totalStudents,
      totalAdmins,
      totalEnrollments,
      activeEnrollments,
      expiredEnrollments,
      lifetimeEnrollments,
      totalDocuments,
      publicDocuments,
      privateDocuments,
      totalEnunciados,
      totalAccesses,
      totalBlogPosts,
      publishedBlogPosts,
      totalQRCodes,
      activeQRCodes,
      totalNewsletterSubscribers,
      activeNewsletterSubscribers,
    ] = await Promise.all([
      // Usuários
      prisma.user.count(),
      prisma.user.count({ where: { role: 'student' } }),
      prisma.user.count({ where: { role: 'admin' } }),

      // Matrículas
      prisma.enrollment.count(),
      prisma.enrollment.count({
        where: {
          OR: [
            { isLifetime: true },
            { expiresAt: { gte: new Date() } },
          ],
        },
      }),
      prisma.enrollment.count({
        where: {
          isLifetime: false,
          expiresAt: { lt: new Date() },
        },
      }),
      prisma.enrollment.count({ where: { isLifetime: true } }),

      // Documentos
      prisma.document.count(),
      prisma.document.count({ where: { isPublic: true } }),
      prisma.document.count({ where: { isPublic: false } }),
      prisma.document.count({ where: { category: 'enunciados' } }),

      // Acessos
      prisma.accessLog.count(),

      // Blog
      prisma.blogPost.count(),
      prisma.blogPost.count({ where: { isPublished: true } }),

      // QR Codes
      prisma.qRCode.count(),
      prisma.qRCode.count({ where: { validUntil: { gte: new Date() } } }),

      // Newsletter
      prisma.newsletterSubscriber.count(),
      prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    ]);

    // Calcular taxa de renovação
    const renewalRate = activeEnrollments > 0
      ? ((activeEnrollments / totalEnrollments) * 100).toFixed(1)
      : '0.0';

    return NextResponse.json({
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
        renewalRate: `${renewalRate}%`,
      },
      documents: {
        total: totalDocuments,
        public: publicDocuments,
        private: privateDocuments,
      },
      enunciados: {
        total: totalEnunciados,
      },
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
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    apiLogger.error({ err: error }, '[Analytics Summary] Erro:');
    return NextResponse.json(
      { error: 'Erro ao buscar métricas' },
      { status: 500 }
    );
  }
});
