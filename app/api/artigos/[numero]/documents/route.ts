import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCache, CacheKeys, CACHE_TTL } from '@/lib/cache/redis-client';

/**
 * GET /api/artigos/[numero]/documents
 * Retorna documentos E atos legislativos relacionados a um artigo específico da Lei 14.133/2021
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero } = await context.params;

    // Valida número do artigo
    const articleNum = parseInt(numero);
    if (isNaN(articleNum) || articleNum < 1 || articleNum > 195) {
      return NextResponse.json(
        { error: 'Número de artigo inválido' },
        { status: 400 }
      );
    }

    const result = await withCache(
      CacheKeys.articleDocuments(numero),
      async () => {
        // Busca em paralelo: Documents E LegislativeActs
        const [documents, legislativeActs] = await Promise.all([
          prisma.document.findMany({
            where: {
              leiArticles: {
                contains: `"${numero}"`
              }
            },
            include: {
              metaTcu: true,
            },
            orderBy: [
              { isPublic: 'desc' },
              { uploadedAt: 'desc' }
            ]
          }),
          prisma.legislativeAct.findMany({
            where: {
              leiArticles: {
                contains: `"${numero}"`
              }
            },
            orderBy: [
              { publishDate: 'desc' }
            ]
          })
        ]);

        const mappedDocuments = documents.map(doc => ({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          type: doc.type,
          category: doc.category,
          courseId: doc.courseId,
          isPublic: doc.isPublic,
          url: doc.url,
          uploadedAt: doc.uploadedAt,
          leiArticles: doc.leiArticles,
          sourceType: 'document' as const,
          // Campos TCU enriquecidos (via metaTcu satellite table)
          ...(doc.category === 'acordao' ? {
            metaTcu: doc.metaTcu ? {
              numeroAcordao: doc.metaTcu.numeroAcordao,
              relator: doc.metaTcu.relator,
              orgaoJulgador: doc.metaTcu.orgaoJulgador,
              dataJulgamento: doc.metaTcu.dataJulgamento,
              area: doc.metaTcu.area,
              tema: doc.metaTcu.tema,
            } : null,
            summary: doc.summary,
            summaryHighlights: doc.summaryHighlights,
          } : {}),
          // Campo entityType (para enunciados)
          ...(doc.category === 'enunciados' ? {
            entityType: doc.entityType,
          } : {}),
        }));

        const mappedLegislativeActs = legislativeActs.map(act => ({
          id: act.id,
          title: act.fullNumber,
          description: act.summary || act.ementa.substring(0, 200),
          type: 'legislative-act',
          category: act.type,
          courseId: null,
          isPublic: true,
          url: `/legislacao/${act.id}`,
          uploadedAt: act.publishDate,
          leiArticles: act.leiArticles,
          sourceType: 'legislative-act' as const,
          fullNumber: act.fullNumber,
          issuer: act.issuer,
          ementa: act.ementa
        }));

        const allDocuments = [
          ...mappedDocuments,
          ...mappedLegislativeActs
        ].sort((a, b) => {
          if (a.isPublic !== b.isPublic) {
            return a.isPublic ? -1 : 1;
          }
          const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
          const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
          return dateB - dateA;
        });

        return {
          articleNumber: numero,
          total: allDocuments.length,
          documents: allDocuments,
          breakdown: {
            regularDocuments: mappedDocuments.length,
            legislativeActs: mappedLegislativeActs.length
          }
        };
      },
      CACHE_TTL.ARTICLE_DETAILS,
      { prefix: 'article' }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao buscar documentos do artigo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documentos' },
      { status: 500 }
    );
  }
}
