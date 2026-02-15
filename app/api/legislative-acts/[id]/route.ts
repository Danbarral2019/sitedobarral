import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { apiLogger } from '@/lib/logger';
import { safeParseArray } from '@/lib/utils';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

/**
 * GET /api/legislative-acts/[id]
 *
 * Retorna um ato normativo (LegislativeAct) pelo ID.
 * Usado pela página da Lei 14.133 comentada para exibir detalhes de decretos, INs, portarias, etc.
 *
 * IMPORTANTE: Retorna no mesmo formato que /api/documents/[id] para compatibilidade com DocumentDetails
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: actId } = await context.params;

    const act = await prisma.legislativeAct.findUnique({
      where: { id: actId },
    });

    if (!act) {
      apiLogger.warn({ actId }, 'Legislative act not found');
      throw new NotFoundError('Ato normativo');
    }

    // Incrementar contador de visualizações (fire and forget)
    prisma.legislativeAct.update({
      where: { id: actId },
      data: { viewCount: { increment: 1 } }
    }).catch(err => console.error('Erro ao incrementar viewCount:', err));

    // Cache the formatted response
    const formattedResponse = await withCache(
      CacheKeys.legislativeActs({ type: actId }),
      async () => ({
        id: act.id,
        title: `${act.fullNumber} - ${act.title}`,
        fullNumber: act.fullNumber,
        type: act.type,
        category: act.type,
        description: act.ementa,
        ementa: act.ementa,
        summary: act.summary,
        content: act.content,
        url: act.officialUrl || act.pdfUrl,
        pdfUrl: act.pdfUrl,
        officialUrl: act.officialUrl,
        issuer: act.issuer,
        publishDate: act.publishDate,
        effectiveDate: act.effectiveDate,
        hierarchyLevel: act.hierarchyLevel,
        leiArticles: safeParseArray(act.leiArticles),
        isPublic: true,
        keyPoints: null,
        tags: '[]',
        courseId: null,
        createdAt: act.createdAt,
        updatedAt: act.updatedAt,
      }),
      CACHE_TTL.LEGISLATIVE_ACTS,
      { prefix: 'acts' }
    );

    apiLogger.info({ actId, fullNumber: act.fullNumber }, 'Legislative act fetched successfully');
    return NextResponse.json(formattedResponse, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
