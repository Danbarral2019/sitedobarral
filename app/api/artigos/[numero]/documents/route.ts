import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/artigos/[numero]/documents
 * Retorna documentos relacionados a um artigo específico da Lei 14.133/2021
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero } = await context.params;

    // Valida número do artigo
    const articleNum = parseInt(numero);
    if (isNaN(articleNum) || articleNum < 1 || articleNum > 193) {
      return NextResponse.json(
        { error: 'Número de artigo inválido' },
        { status: 400 }
      );
    }

    // Busca documentos que contêm este artigo
    const documents = await prisma.document.findMany({
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
    });

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
    }));

    return NextResponse.json({
      articleNumber: numero,
      total: mappedDocuments.length,
      documents: mappedDocuments
    });
  } catch (error) {
    console.error('Erro ao buscar documentos do artigo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documentos' },
      { status: 500 }
    );
  }
}
