import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRecommendations, ContentItem } from '@/lib/recommendations';

/**
 * GET /api/recommendations/documents/[id]
 * Retorna documentos recomendados baseado em um documento específico
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    // Busca o documento fonte
    const sourceDoc = await prisma.document.findUnique({
      where: { id }
    });

    if (!sourceDoc) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // Busca todos os documentos públicos ou do mesmo curso
    const candidateDocs = await prisma.document.findMany({
      where: {
        OR: [
          { isPublic: true },
          { courseId: sourceDoc.courseId }
        ],
        id: { not: id } // Exclui o próprio documento
      },
      take: 100 // Limita candidatos para performance
    });

    // Converte para ContentItem
    const sourceItem: ContentItem = {
      id: sourceDoc.id,
      title: sourceDoc.title,
      description: sourceDoc.description || undefined,
      category: sourceDoc.category,
      courseId: sourceDoc.courseId,
      tags: sourceDoc.tags || undefined,
      leiArticles: sourceDoc.leiArticles || undefined,
    };

    const candidateItems: ContentItem[] = candidateDocs.map(doc => ({
      id: doc.id,
      title: doc.title,
      description: doc.description || undefined,
      category: doc.category,
      courseId: doc.courseId,
      tags: doc.tags || undefined,
      leiArticles: doc.leiArticles || undefined,
    }));

    // Gera recomendações
    const recommendations = generateRecommendations(sourceItem, candidateItems, limit);

    // Busca detalhes completos dos documentos recomendados
    const recommendedDocs = await prisma.document.findMany({
      where: {
        id: { in: recommendations.map(r => r.id) }
      }
    });

    // Mapeia recomendações com detalhes
    const result = recommendations.map(rec => {
      const doc = recommendedDocs.find(d => d.id === rec.id);
      return {
        id: rec.id,
        title: rec.title,
        score: rec.score,
        reason: rec.reason,
        document: doc ? {
          description: doc.description,
          category: doc.category,
          type: doc.type,
          isPublic: doc.isPublic,
          url: doc.url,
        } : null
      };
    });

    return NextResponse.json({
      sourceDocumentId: id,
      total: result.length,
      recommendations: result
    });
  } catch (error) {
    console.error('Erro ao gerar recomendações:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar recomendações' },
      { status: 500 }
    );
  }
}
