import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/area-restrita/batch-data
 *
 * Batch endpoint para buscar todos os dados necessários da área restrita em uma única chamada
 * Reduz 15+ requests para 1 único request
 *
 * Query params:
 * - courseIds: string (comma-separated, e.g., "1,2,3")
 *
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     documents: { [courseId]: Document[] },
 *     videos: { [courseId]: CourseVideo[] },
 *     sites: { [courseId]: RecommendedSite[] }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verificação de autenticação
    const token = request.cookies.get('auth-token')?.value;
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

    // Parse courseIds from query params
    const searchParams = request.nextUrl.searchParams;
    const courseIdsParam = searchParams.get('courseIds');

    if (!courseIdsParam) {
      return NextResponse.json(
        { error: 'courseIds parameter required' },
        { status: 400 }
      );
    }

    const courseIds = courseIdsParam.split(',').filter(Boolean);

    if (courseIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          documents: {},
          videos: {},
          sites: {},
        },
      });
    }

    console.log('[Batch-Data] Iniciando busca paralela para cursos:', courseIds);

    // Busca dados necessários (com fallback para arrays vazios em caso de erro)
    let documents = [];
    let videos = [];
    let siteToCourse = [];

    // Buscar documentos (essencial - deve funcionar)
    // Inclui documentos específicos do curso E documentos comuns (isCommon=true)
    try {
      console.log('[Batch-Data] Buscando documentos...');
      documents = await prisma.document.findMany({
        where: {
          OR: [
            { courseId: { in: courseIds } }, // Específicos do curso
            { isCommon: true },               // Comuns a todos os cursos
          ],
        },
        orderBy: [
          { onNumber: 'desc' },  // Ordem decrescente por número (ON 101, 100, ..., 2, 1)
          { onYear: 'desc' },    // Desempate por ano mais recente
          { title: 'desc' },     // Fallback para documentos sem onNumber
        ],
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          url: true,
          category: true,
          courseId: true,
          isPublic: true,
          isCommon: true, // Incluir campo isCommon na resposta
          tags: true,
          leiArticles: true,
          // OTIMIZAÇÃO: Removidos size e updatedAt (não usados na lista inicial)
          onNumber: true, // Número da ON (para ordenação)
          onYear: true,   // Ano da ON (para ordenação)
          uploadedAt: true,
        },
      });
      console.log('[Batch-Data] Documentos encontrados:', documents.length);
      console.log('[Batch-Data] Documentos comuns:', documents.filter(d => d.isCommon).length);
    } catch (error) {
      console.error('[Batch-Data] ERRO ao buscar documentos:', error);
      // Relança erro pois documentos são essenciais
      throw error;
    }

    // Buscar vídeos (opcional - pode falhar sem quebrar tudo)
    try {
      console.log('[Batch-Data] Buscando vídeos...');
      videos = await prisma.courseVideo.findMany({
        where: {
          courseId: { in: courseIds },
          isActive: true,
        },
        orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          courseId: true,
          title: true,
          description: true,
          youtubeUrl: true,
          youtubeId: true,
          thumbnailUrl: true,
          displayOrder: true,
        },
      });
      console.log('[Batch-Data] Vídeos encontrados:', videos.length);
    } catch (error) {
      console.error('[Batch-Data] AVISO: Erro ao buscar vídeos (continuando sem vídeos):', error);
      videos = []; // Continua sem vídeos
    }

    // Buscar sites recomendados (opcional - pode falhar sem quebrar tudo)
    try {
      console.log('[Batch-Data] Buscando sites recomendados...');
      siteToCourse = await prisma.siteToCourse.findMany({
        where: {
          courseId: { in: courseIds },
        },
        orderBy: [
          { displayOrder: 'asc' },
        ],
        include: {
          site: {
            where: {
              isActive: true,
            },
            select: {
              id: true,
              title: true,
              description: true,
              url: true,
              faviconUrl: true,
              category: true,
            },
          },
        },
      });
      console.log('[Batch-Data] Sites encontrados:', siteToCourse.length);
    } catch (error) {
      console.error('[Batch-Data] AVISO: Erro ao buscar sites (continuando sem sites):', error);
      siteToCourse = []; // Continua sem sites
    }

    // Agrupar resultados por courseId para fácil acesso no frontend
    const groupedDocuments: Record<string, typeof documents> = {};
    const groupedVideos: Record<string, typeof videos> = {};
    const groupedSites: Record<string, Array<typeof siteToCourse[0]['site']>> = {};

    // Inicializar objetos com arrays vazios para cada curso
    courseIds.forEach(courseId => {
      groupedDocuments[courseId] = [];
      groupedVideos[courseId] = [];
      groupedSites[courseId] = [];
    });

    // Agrupar documentos
    documents.forEach(doc => {
      if (doc.isCommon) {
        // Documento comum: adicionar a TODOS os cursos
        courseIds.forEach(courseId => {
          groupedDocuments[courseId].push(doc);
        });
      } else if (doc.courseId && groupedDocuments[doc.courseId]) {
        // Documento específico: adicionar apenas ao curso correspondente
        groupedDocuments[doc.courseId].push(doc);
      }
    });

    // Agrupar vídeos
    videos.forEach(video => {
      if (video.courseId && groupedVideos[video.courseId]) {
        groupedVideos[video.courseId].push(video);
      }
    });

    // Agrupar sites (filtrando sites null que foram excluídos pela condição isActive)
    siteToCourse.forEach(stc => {
      if (stc.site && stc.courseId && groupedSites[stc.courseId]) {
        groupedSites[stc.courseId].push(stc.site);
      }
    });

    console.log('[Batch-Data] Agrupamento concluído. Docs por curso:',
      Object.entries(groupedDocuments).map(([id, docs]) => `${id}:${docs.length}`).join(', '));

    return NextResponse.json({
      success: true,
      data: {
        documents: groupedDocuments,
        videos: groupedVideos,
        sites: groupedSites,
      },
    });

  } catch (error) {
    console.error('Erro ao buscar dados batch da área restrita:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados' },
      { status: 500 }
    );
  }
}
