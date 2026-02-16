import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { courses } from '@/data/courses';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';
import type { ContentType, ContentTreeNode, ContentTreeResponse } from '@/lib/types/global-search';

// Categorias que devem ser agrupadas sob "Pareceres"
const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor'];

// Labels de órgãos para sub-agrupamento de enunciados
const ENTITY_TYPE_LABELS: Record<string, string> = {
  'INCP': 'INCP - Instituto Nacional de Contratações Públicas',
  'IBDA': 'IBDA - Instituto Brasileiro de Direito Administrativo',
  'CJF': 'CJF - Conselho da Justiça Federal',
  'FONACON': 'FONACON - Fórum Nacional de Contas',
  'PGE-SP': 'PGE-SP - Procuradoria Geral do Estado de São Paulo',
  'AGE-MG': 'AGE-MG - Advocacia-Geral do Estado de Minas Gerais',
};

// Categorias de materiais do curso (excluídas da árvore de documentos)
const COURSE_MATERIAL_CATEGORIES = ['apostila', 'conteudo-programatico', 'bibliografia', 'material-complementar'];

const COURSE_MATERIAL_LABELS: Record<string, string> = {
  'apostila': 'Apostila',
  'conteudo-programatico': 'Conteúdo Programático',
  'bibliografia': 'Bibliografia',
  'material-complementar': 'Material Complementar',
};

// Mapeamento de categorias para nomes amigáveis
const CATEGORY_LABELS: Record<string, string> = {
  'pareceres': 'Pareceres',
  'orientacao-normativa': 'Orientações Normativas',
  'enunciados': 'Enunciados',
  'acordao': 'Acórdãos TCU',
  'sumula': 'Súmulas TCU',
  'consulta_tcu': 'Respostas a Consultas TCU',
  'informativo': 'Informativos de Licitação TCU',
  'manual-tcu': 'Manual do TCU',
  'boa_pratica': 'Outros Atos Normativos',
  'ato-normativo': 'Normativos',
  'outro': 'Outros',
};

// Categorias que não devem aparecer na sidebar
const HIDDEN_CATEGORIES = ['lei-artigo'];

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

    // Filter to only course IDs that exist in the courses data (exclude phantom courses like removed course 1)
    const validCourseIds = enrolledCourseIds.filter(cId => courses.some(c => c.id === cId));

    const tree: ContentTreeNode[] = [];
    let totalCount = 0;

    // Run all counts in parallel
    const [
      documentsByCourseCounts,
      leiArticlesCount,
      glossaryCount,
      videosByCourseCounts,
      sitesCount,
      legislativeActsCount,
      modulesCountByCourse,
      enunciadosByEntity,
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

      // 4. Videos grouped by course
      prisma.courseVideo.groupBy({
        by: ['courseId'],
        where: {
          isActive: true,
          courseId: { in: enrolledCourseIds },
        },
        _count: { id: true },
      }),

      // 5. Sites count (linked to enrolled courses)
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

      // 6. Legislative Acts count
      prisma.legislativeAct.count(),

      // 7. LMS modules count by course
      prisma.module.groupBy({
        by: ['courseId'],
        where: {
          courseId: { in: enrolledCourseIds },
          isPublished: true,
        },
        _count: { id: true },
      }),

      // 8. Enunciados sub-grouped by entityType
      prisma.document.groupBy({
        by: ['entityType'],
        where: {
          category: 'enunciados',
          entityType: { not: null },
        },
        _count: { id: true },
      }),
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

    // Build a map of courseId -> module count for quick lookup
    const lmsModuleCountMap: Record<string, number> = {};
    modulesCountByCourse.forEach((g) => {
      lmsModuleCountMap[g.courseId] = g._count.id;
    });

    // Check if any enrolled course has LMS modules
    const hasAnyLmsModules = validCourseIds.some((cId) => (lmsModuleCountMap[cId] || 0) > 0);

    if (validCourseIds.length > 0) {
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
      validCourseIds.forEach((cId) => {
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

      if (validCourseIds.length === 1) {
        // Single course: categories directly under "Materiais do Curso"
        const cId = validCourseIds[0];
        const cats = materialsByCourse[cId] || {};
        materialChildren = buildMaterialCategoryNodes(cId, cats);
      } else {
        // Multiple courses: group by course (include ALL valid courses)
        materialChildren = validCourseIds
          .map((cId) => {
            const course = courses.find(c => c.id === cId);
            const cats = materialsByCourse[cId] || {};
            const courseTotal = Object.values(cats).reduce((s, n) => s + n, 0);
            return {
              id: `mat-${cId}`,
              type: 'course-material' as ContentType,
              label: course?.title || 'Curso',
              count: courseTotal || (lmsModuleCountMap[cId] || 0),
              courseId: cId,
              children: Object.keys(cats).length > 0 ? buildMaterialCategoryNodes(cId, cats) : undefined,
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

    // Aggregate all document categories (no course grouping in Base de Conhecimento)
    // Course documents appear ONLY under "Materiais do Curso", not here
    const aggregatedCategories: Record<string, number> = {};

    regularDocCounts.forEach((group) => {
      const displayCategory = PARECER_CATEGORIES.includes(group.category)
        ? 'pareceres'
        : group.category;

      aggregatedCategories[displayCategory] = (aggregatedCategories[displayCategory] || 0) + group._count.id;
    });

    // Build document children - flat list of categories (no course grouping)
    const documentChildren: ContentTreeNode[] = [];

    Object.entries(aggregatedCategories)
      .filter(([cat]) => !HIDDEN_CATEGORIES.includes(cat))
      .forEach(([cat, count]) => {
        // Para enunciados, adicionar sub-nós por entityType
        let children: ContentTreeNode[] | undefined;
        if (cat === 'enunciados' && enunciadosByEntity.length > 0) {
          children = enunciadosByEntity.map((group) => ({
            id: `doc-enunciados-${group.entityType}`,
            type: 'document' as const,
            label: ENTITY_TYPE_LABELS[group.entityType!] || group.entityType!,
            count: group._count.id,
            category: 'enunciados',
          }));
        }

        documentChildren.push({
          id: `doc-${cat}`,
          type: 'document' as const,
          label: getCategoryLabel(cat),
          count,
          category: cat,
          children,
        });
      });

    // Build Lei 14.133 node (as child of Base de Conhecimento)
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

    const leiNode: ContentTreeNode = {
      id: 'lei',
      type: 'lei',
      label: 'Lei 14.133 Comentada',
      count: leiArticlesCount + legislativeActsCount,
      children: leiChildren.length > 0 ? leiChildren : undefined,
    };

    // Add Lei 14.133 as FIRST sub-node of Base de Conhecimento
    documentChildren.unshift(leiNode);

    tree.push({
      id: 'documents',
      type: 'document',
      label: 'Base de Conhecimento',
      count: docsTotal + leiArticlesCount + legislativeActsCount,
      children: documentChildren,
    });

    // Build Glossary tree node
    totalCount += glossaryCount;
    tree.push({
      id: 'glossary',
      type: 'glossary',
      label: 'Glossário',
      count: glossaryCount,
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
