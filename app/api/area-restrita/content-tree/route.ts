import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { courses } from '@/data/courses';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import type { ContentType, ContentTreeNode, ContentTreeResponse } from '@/lib/types/global-search';

// Categorias que devem ser agrupadas sob "Pareceres"
const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor'];

// Categorias de materiais do curso (excluídas da árvore de documentos)
const COURSE_MATERIAL_CATEGORIES = ['apostila', 'conteudo-programatico', 'bibliografia'];

const COURSE_MATERIAL_LABELS: Record<string, string> = {
  'apostila': 'Apostila',
  'conteudo-programatico': 'Conteúdo Programático',
  'bibliografia': 'Bibliografia',
};

// Mapeamento de categorias para nomes amigáveis
const CATEGORY_LABELS: Record<string, string> = {
  'pareceres': 'Pareceres',
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
      legislativeActsCount,
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

      // 7. Legislative Acts count
      prisma.legislativeAct.count(),
    ]);

    // Separate course materials from regular documents
    const materialCounts = documentsByCourseCounts.filter(g =>
      COURSE_MATERIAL_CATEGORIES.includes(g.category)
    );
    const regularDocCounts = documentsByCourseCounts.filter(g =>
      !COURSE_MATERIAL_CATEGORIES.includes(g.category)
    );

    // === Build "Materiais do Curso" tree node ===
    const materialsTotal = materialCounts.reduce((sum, g) => sum + g._count.id, 0);
    totalCount += materialsTotal;

    if (materialsTotal > 0) {
      // Group materials: merge common (courseId=null) into each enrolled course
      const materialsByCourse: Record<string, Record<string, number>> = {};
      const commonMaterials: Record<string, number> = {};

      materialCounts.forEach((group) => {
        if (!group.courseId) {
          commonMaterials[group.category] = (commonMaterials[group.category] || 0) + group._count.id;
        } else {
          if (!materialsByCourse[group.courseId]) materialsByCourse[group.courseId] = {};
          materialsByCourse[group.courseId][group.category] =
            (materialsByCourse[group.courseId][group.category] || 0) + group._count.id;
        }
      });

      // Merge common materials into each enrolled course
      enrolledCourseIds.forEach((cId) => {
        if (!materialsByCourse[cId]) materialsByCourse[cId] = {};
        Object.entries(commonMaterials).forEach(([cat, count]) => {
          materialsByCourse[cId][cat] = (materialsByCourse[cId][cat] || 0) + count;
        });
      });

      const buildMaterialCategoryNodes = (courseId: string | undefined, cats: Record<string, number>): ContentTreeNode[] =>
        Object.entries(cats).map(([cat, count]) => ({
          id: courseId ? `mat-${courseId}-${cat}` : `mat-${cat}`,
          type: 'course-material' as ContentType,
          label: COURSE_MATERIAL_LABELS[cat] || cat,
          count,
          courseId,
          category: cat,
        }));

      let materialChildren: ContentTreeNode[] | undefined;

      if (enrolledCourseIds.length === 1) {
        // Single course: categories directly under "Materiais do Curso"
        const cId = enrolledCourseIds[0];
        const cats = materialsByCourse[cId] || {};
        materialChildren = buildMaterialCategoryNodes(cId, cats);
      } else {
        // Multiple courses: group by course
        materialChildren = enrolledCourseIds
          .filter((cId) => materialsByCourse[cId] && Object.keys(materialsByCourse[cId]).length > 0)
          .map((cId) => {
            const course = courses.find(c => c.id === cId);
            const cats = materialsByCourse[cId];
            const courseTotal = Object.values(cats).reduce((s, n) => s + n, 0);
            return {
              id: `mat-${cId}`,
              type: 'course-material' as ContentType,
              label: course?.title || 'Curso',
              count: courseTotal,
              courseId: cId,
              children: buildMaterialCategoryNodes(cId, cats),
            };
          });
      }

      tree.push({
        id: 'course-materials',
        type: 'course-material' as ContentType,
        label: 'Materiais do Curso',
        count: materialsTotal,
        children: materialChildren && materialChildren.length > 0 ? materialChildren : undefined,
      });
    }

    // === Build Documents tree node (excluding course materials) ===
    const docsTotal = regularDocCounts.reduce((sum, g) => sum + g._count.id, 0);
    totalCount += docsTotal;

    // Group documents by course, merging common into each enrolled course
    const docsByCourse: Record<string, { count: number; categories: Record<string, number> }> = {};
    const commonDocCategories: Record<string, number> = {};

    regularDocCounts.forEach((group) => {
      const displayCategory = PARECER_CATEGORIES.includes(group.category)
        ? 'pareceres'
        : group.category;

      if (!group.courseId) {
        // Common document: accumulate separately for merging
        commonDocCategories[displayCategory] = (commonDocCategories[displayCategory] || 0) + group._count.id;
      } else {
        if (!docsByCourse[group.courseId]) {
          docsByCourse[group.courseId] = { count: 0, categories: {} };
        }
        docsByCourse[group.courseId].count += group._count.id;
        docsByCourse[group.courseId].categories[displayCategory] =
          (docsByCourse[group.courseId].categories[displayCategory] || 0) + group._count.id;
      }
    });

    // Merge common documents into each enrolled course
    enrolledCourseIds.forEach((courseId) => {
      if (!docsByCourse[courseId]) {
        docsByCourse[courseId] = { count: 0, categories: {} };
      }
      Object.entries(commonDocCategories).forEach(([cat, count]) => {
        docsByCourse[courseId].count += count;
        docsByCourse[courseId].categories[cat] = (docsByCourse[courseId].categories[cat] || 0) + count;
      });
    });

    // Build document children
    const documentChildren: ContentTreeNode[] = [];

    if (enrolledCourseIds.length === 1) {
      // Single course: categories directly under "Documentos"
      const courseId = enrolledCourseIds[0];
      if (docsByCourse[courseId]) {
        Object.entries(docsByCourse[courseId].categories).map(([cat, count]) => {
          documentChildren.push({
            id: `doc-${courseId}-${cat}`,
            type: 'document' as const,
            label: getCategoryLabel(cat),
            count,
            courseId,
            category: cat,
          });
        });
      }
    } else {
      // Multiple courses: group by course
      enrolledCourseIds.forEach((courseId) => {
        if (docsByCourse[courseId] && docsByCourse[courseId].count > 0) {
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
    }

    tree.push({
      id: 'documents',
      type: 'document',
      label: 'Documentos',
      count: docsTotal,
      children: documentChildren,
    });

    // Build Lei 14.133 tree node (with Atos Normativos as child)
    const leiChildren: ContentTreeNode[] = [];
    if (legislativeActsCount > 0) {
      leiChildren.push({
        id: 'legislative-acts',
        type: 'legislative-act' as ContentType,
        label: 'Atos Normativos Infralegais',
        count: legislativeActsCount,
      });
    }
    totalCount += leiArticlesCount + legislativeActsCount;
    tree.push({
      id: 'lei',
      type: 'lei',
      label: 'Lei 14.133',
      count: leiArticlesCount + legislativeActsCount,
      children: leiChildren.length > 0 ? leiChildren : undefined,
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
