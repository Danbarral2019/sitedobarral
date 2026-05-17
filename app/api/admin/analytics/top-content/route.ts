import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';

/**
 * GET /api/admin/analytics/top-content
 * Retorna top documentos, cursos e usuários (lazy loading)
 */
export const GET = withAdminApi(async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Top documentos mais acessados
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

  // Buscar detalhes dos documentos
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

  const documentsMap = new Map(documents.map(doc => [doc.id, doc]));

  const topDocumentsWithDetails = topDocuments
    .map(item => {
      const doc = item.documentId ? documentsMap.get(item.documentId) : null;
      return doc ? {
        ...doc,
        accessCount: item._count.id,
      } : null;
    })
    .filter((doc): doc is NonNullable<typeof doc> => doc !== null);

  // Top cursos mais acessados
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

  const topCoursesFormatted = topCourses.map(item => ({
    courseId: item.courseId || '',
    accessCount: item._count.id,
  }));

  // Top usuários mais ativos
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

  // Buscar detalhes dos usuários
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

  const usersMap = new Map(users.map(user => [user.id, user]));

  const topUsersWithDetails = topUsers
    .map(item => {
      const user = item.userId ? usersMap.get(item.userId) : null;
      return user ? {
        ...user,
        accessCount: item._count.id,
      } : null;
    })
    .filter((user): user is NonNullable<typeof user> => user !== null);

  return NextResponse.json({
    topDocuments: topDocumentsWithDetails,
    topCourses: topCoursesFormatted,
    topUsers: topUsersWithDetails,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=360',
    },
  });
});
