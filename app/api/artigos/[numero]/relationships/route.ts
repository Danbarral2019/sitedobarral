import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ArticleRelationship {
  articleNumber: string;
  coOccurrences: number; // Quantas vezes aparecem juntos
  strength: number; // 0-100 (força do relacionamento)
  sharedDocuments: number; // Número de documentos compartilhados
}

// GET /api/artigos/[numero]/relationships - Obter artigos relacionados por co-ocorrência
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero: articleNumber } = await params;

    if (!articleNumber) {
      return NextResponse.json(
        { error: 'Número do artigo é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar todos os documentos que mencionam este artigo
    const documentsWithThisArticle = await prisma.document.findMany({
      where: {
        leiArticles: {
          contains: articleNumber,
        },
      },
      select: {
        id: true,
        leiArticles: true,
      },
    });

    if (documentsWithThisArticle.length === 0) {
      return NextResponse.json({
        articleNumber,
        relationships: [],
        totalDocuments: 0,
      });
    }

    // Mapear co-ocorrências
    const coOccurrenceMap = new Map<string, number>();

    documentsWithThisArticle.forEach((doc) => {
      if (!doc.leiArticles) return;

      try {
        const articles = JSON.parse(doc.leiArticles) as string[];

        // Para cada artigo que aparece junto com o artigo atual
        articles.forEach((otherArticle) => {
          // Normalizar (remover espaços, garantir string)
          const normalized = String(otherArticle).trim();

          // Ignorar o próprio artigo
          if (normalized === articleNumber) return;

          // Incrementar contador de co-ocorrências
          const current = coOccurrenceMap.get(normalized) || 0;
          coOccurrenceMap.set(normalized, current + 1);
        });
      } catch (error) {
        console.error('Erro ao parsear leiArticles:', doc.id, error);
      }
    });

    // Converter para array e calcular força do relacionamento
    const totalDocs = documentsWithThisArticle.length;
    const relationships: ArticleRelationship[] = [];

    coOccurrenceMap.forEach((count, article) => {
      // Força = porcentagem de documentos onde aparecem juntos
      const strength = Math.round((count / totalDocs) * 100);

      relationships.push({
        articleNumber: article,
        coOccurrences: count,
        strength,
        sharedDocuments: count,
      });
    });

    // Ordenar por força de relacionamento (descendente)
    relationships.sort((a, b) => b.strength - a.strength);

    // Limitar aos top 20 relacionamentos mais fortes
    const topRelationships = relationships.slice(0, 20);

    return NextResponse.json({
      articleNumber,
      relationships: topRelationships,
      totalDocuments: totalDocs,
      totalRelatedArticles: relationships.length,
    });
  } catch (error) {
    console.error('Erro ao calcular relacionamentos:', error);
    return NextResponse.json(
      { error: 'Erro ao calcular relacionamentos entre artigos' },
      { status: 500 }
    );
  }
}
