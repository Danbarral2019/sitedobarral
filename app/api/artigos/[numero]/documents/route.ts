import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Busca em paralelo: Documents E LegislativeActs
    const [documents, legislativeActs] = await Promise.all([
      // 1. Busca documentos que contêm este artigo
      prisma.document.findMany({
        where: {
          leiArticles: {
            contains: `"${numero}"`
          }
        },
        orderBy: [
          { isPublic: 'desc' }, // Públicos primeiro
          { uploadedAt: 'desc' }
        ],
        take: 50 // Limita a 50 documentos
      }),

      // 2. Busca atos legislativos (Decretos, Portarias, etc.) que regulamentam este artigo
      prisma.legislativeAct.findMany({
        where: {
          leiArticles: {
            contains: `"${numero}"`
          }
        },
        orderBy: [
          { publishDate: 'desc' }
        ],
        take: 50
      })
    ]);

    // Mapeia documentos para formato de resposta
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
      sourceType: 'document' as const
    }));

    // Mapeia atos legislativos para formato de resposta (sempre públicos)
    const mappedLegislativeActs = legislativeActs.map(act => ({
      id: act.id,
      title: act.fullNumber, // "Decreto 11.462/2023"
      description: act.summary || act.ementa.substring(0, 200),
      type: 'legislative-act',
      category: act.type, // "decreto", "portaria", "in", etc.
      courseId: null,
      isPublic: true, // Atos legislativos são sempre públicos
      url: `/legislacao/${act.id}`,
      uploadedAt: act.publishDate,
      leiArticles: act.leiArticles,
      sourceType: 'legislative-act' as const,
      // Dados adicionais específicos de atos legislativos
      fullNumber: act.fullNumber,
      issuer: act.issuer,
      ementa: act.ementa
    }));

    // Combina e ordena: públicos primeiro, depois por data
    const allDocuments = [
      ...mappedDocuments,
      ...mappedLegislativeActs
    ].sort((a, b) => {
      // Primeiro critério: públicos antes de restritos
      if (a.isPublic !== b.isPublic) {
        return a.isPublic ? -1 : 1;
      }
      // Segundo critério: mais recentes primeiro
      const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      articleNumber: numero,
      total: allDocuments.length,
      documents: allDocuments,
      breakdown: {
        regularDocuments: mappedDocuments.length,
        legislativeActs: mappedLegislativeActs.length
      }
    });
  } catch (error) {
    console.error('Erro ao buscar documentos do artigo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documentos' },
      { status: 500 }
    );
  }
}
