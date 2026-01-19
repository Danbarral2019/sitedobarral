import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { courses } from '@/data/courses';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import type { ContentTreeNode, ContentTreeResponse } from '@/lib/types/global-search';

// Mapeamento de categorias para nomes amigáveis
const CATEGORY_LABELS: Record<string, string> = {
  'decor': 'Pareceres DECOR',
  'parecer-vinculante': 'Pareceres Vinculantes',
  'parecer': 'Pareceres',
  'orientacao-normativa': 'Orientações Normativas',
  'enunciados': 'Enunciados',
  'acordao': 'Acórdãos TCU',
  'sumula': 'Súmulas',
  'outro': 'Outros',
};

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authPayload = await verifyToken(token);
    if (!authPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = authPayload.role === 'admin';

    // Fetch user with enrollments from database
    const user = await prisma.user.findUnique({
      where: { id: authPayload.userId },
      include: { enrollments: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get enrolled course IDs
    const enrolledCourseIds = isAdmin
      ? courses.map(c => c.id)
      : user.enrollments.map(e => e.courseId);

    const tree: ContentTreeNode[] = [];
    let totalCount = 0;

    // Run all counts in parallel
    const [
      documentsByCourseCounts,
      leiArticlesCount,
      glossaryCount,
      faqCount,
      videosByCourseCounts,
      sitesCount,
    ] = await Promise.all([
      // 1. Documents grouped by course and category
      prisma.document.groupBy({
        by: ['courseId', 'category'],
        where: {
          OR: [
            { isCommon: true },
            { isPublic: true },
            ...(enrolledCourseIds.length > 0
              ? [{ courseId: { in: enrolledCourseIds } }]
              : []),
          ],
        },
        _count: { id: true },
      }),

      // 2. Lei articles count (static data)
      Promise.resolve(Object.keys(LEI_14133_ARTIGOS).length),

      // 3. Glossary count
      prisma.glossaryTerm.count({
        where: { isPublic: true },
      }),

      // 4. FAQ count
      prisma.fAQ.count({
        where: { isPublished: true },
      }),

      // 5. Videos grouped by course
      prisma.courseVideo.groupBy({
        by: ['courseId'],
        where: {
          isActive: true,
          courseId: { in: enrolledCourseIds },
        },
        _count: { id: true },
      }),

      // 6. Sites count (linked to enrolled courses)
      (async () => {
        const siteToCourses = await prisma.siteToCourse.findMany({
          where: {
            courseId: { in: enrolledCourseIds },
          },
          select: { siteId: true },
        });
        const uniqueSiteIds = [...new Set(siteToCourses.map(s => s.siteId))];
        return prisma.recommendedSite.count({
          where: {
            isActive: true,
            id: { in: uniqueSiteIds },
          },
        });
      })(),
    ]);

    // Build Documents tree node
    const docsTotal = documentsByCourseCounts.reduce((sum, g) => sum + g._count.id, 0);
    totalCount += docsTotal;

    // Group documents by course
    const docsByCourse: Record<string, { count: number; categories: Record<string, number> }> = {};

    documentsByCourseCounts.forEach((group) => {
      const courseId = group.courseId || 'common';
      if (!docsByCourse[courseId]) {
        docsByCourse[courseId] = { count: 0, categories: {} };
      }
      docsByCourse[courseId].count += group._count.id;
      docsByCourse[courseId].categories[group.category] =
        (docsByCourse[courseId].categories[group.category] || 0) + group._count.id;
    });

    // Build document children (by course)
    const documentChildren: ContentTreeNode[] = [];

    // Add common documents if any
    if (docsByCourse['common']) {
      const commonCats = Object.entries(docsByCourse['common'].categories).map(([cat, count]) => ({
        id: `doc-common-${cat}`,
        type: 'document' as const,
        label: getCategoryLabel(cat),
        count,
        category: cat,
      }));

      documentChildren.push({
        id: 'doc-common',
        type: 'document',
        label: 'Materiais Gerais',
        count: docsByCourse['common'].count,
        children: commonCats,
      });
    }

    // Add course-specific documents
    enrolledCourseIds.forEach((courseId) => {
      if (docsByCourse[courseId]) {
        const course = courses.find(c => c.id === courseId);
        const courseCats = Object.entries(docsByCourse[courseId].categories).map(([cat, count]) => ({
          id: `doc-${courseId}-${cat}`,
          type: 'document' as const,
          label: getCategoryLabel(cat),
          count,
          courseId,
          category: cat,
        }));

        documentChildren.push({
          id: `doc-${courseId}`,
          type: 'document',
          label: course?.title || 'Curso',
          count: docsByCourse[courseId].count,
          courseId,
          children: courseCats,
        });
      }
    });

    tree.push({
      id: 'documents',
      type: 'document',
      label: 'Documentos',
      count: docsTotal,
      children: documentChildren,
    });

    // Build Lei 14.133 tree node
    totalCount += leiArticlesCount;
    tree.push({
      id: 'lei',
      type: 'lei',
      label: 'Lei 14.133',
      count: leiArticlesCount,
    });

    // Build Glossary tree node
    totalCount += glossaryCount;
    tree.push({
      id: 'glossary',
      type: 'glossary',
      label: 'Glossário',
      count: glossaryCount,
    });

    // Build FAQ tree node
    totalCount += faqCount;
    tree.push({
      id: 'faq',
      type: 'faq',
      label: 'FAQs',
      count: faqCount,
    });

    // Build Videos tree node
    const videosTotal = videosByCourseCounts.reduce((sum, g) => sum + g._count.id, 0);
    totalCount += videosTotal;

    const videoChildren: ContentTreeNode[] = videosByCourseCounts.map((group) => {
      const course = courses.find(c => c.id === group.courseId);
      return {
        id: `video-${group.courseId}`,
        type: 'video' as const,
        label: course?.title || 'Curso',
        count: group._count.id,
        courseId: group.courseId,
      };
    });

    tree.push({
      id: 'videos',
      type: 'video',
      label: 'Vídeos',
      count: videosTotal,
      children: videoChildren.length > 0 ? videoChildren : undefined,
    });

    // Build Sites tree node
    totalCount += sitesCount;
    tree.push({
      id: 'sites',
      type: 'site',
      label: 'Sites Recomendados',
      count: sitesCount,
    });

    return NextResponse.json({
      tree,
      totalCount,
    } as ContentTreeResponse);
  } catch (error) {
    console.error('[Content Tree] Error:', error);
    return NextResponse.json({ error: 'Failed to build content tree' }, { status: 500 });
  }
}
