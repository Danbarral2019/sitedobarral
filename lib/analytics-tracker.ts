/**
 * Rastreamento e análise de desempenho das sugestões automáticas
 */

import { prisma } from './prisma';
import type { ArticleSuggestion } from './document-analyzer';

export interface AnalysisRecord {
  documentTitle: string;
  documentType?: string;
  textLength: number;
  pageCount?: number;
  citationsFound: number;
  keywordsMatched: number;
  suggestions: ArticleSuggestion[];
  acceptedArticles?: string[];
  userId?: string;
}

/**
 * Salva registro de análise no banco de dados
 */
export async function trackAnalysis(record: AnalysisRecord) {
  try {
    const suggestedArticles = record.suggestions.map(s => s.articleNumber);
    const totalSuggestions = suggestedArticles.length;
    const acceptedCount = record.acceptedArticles?.length || 0;

    // Calcula precision (% de sugestões aceitas)
    const precision = totalSuggestions > 0
      ? (acceptedCount / totalSuggestions) * 100
      : null;

    await prisma.documentAnalysis.create({
      data: {
        documentTitle: record.documentTitle,
        documentType: record.documentType,
        textLength: record.textLength,
        pageCount: record.pageCount,
        citationsFound: record.citationsFound,
        keywordsMatched: record.keywordsMatched,
        suggestedArticles: JSON.stringify(suggestedArticles),
        totalSuggestions,
        acceptedArticles: record.acceptedArticles
          ? JSON.stringify(record.acceptedArticles)
          : null,
        acceptedCount,
        precision,
        userId: record.userId
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar análise:', error);
    return { success: false, error };
  }
}

/**
 * Atualiza registro com artigos aceitos (quando usuário aplica sugestões)
 */
export async function updateAcceptedArticles(
  documentTitle: string,
  acceptedArticles: string[]
) {
  try {
    // Busca análise mais recente para este documento
    const analysis = await prisma.documentAnalysis.findFirst({
      where: { documentTitle },
      orderBy: { createdAt: 'desc' }
    });

    if (!analysis) {
      return { success: false, error: 'Análise não encontrada' };
    }

    const acceptedCount = acceptedArticles.length;
    const precision = analysis.totalSuggestions > 0
      ? (acceptedCount / analysis.totalSuggestions) * 100
      : null;

    await prisma.documentAnalysis.update({
      where: { id: analysis.id },
      data: {
        acceptedArticles: JSON.stringify(acceptedArticles),
        acceptedCount,
        precision
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar artigos aceitos:', error);
    return { success: false, error };
  }
}

/**
 * Obtém estatísticas agregadas de todas as análises
 */
export async function getAnalyticsStats() {
  try {
    const totalAnalyses = await prisma.documentAnalysis.count();

    if (totalAnalyses === 0) {
      return {
        totalAnalyses: 0,
        avgPrecision: 0,
        avgSuggestions: 0,
        avgAccepted: 0,
        totalCitations: 0,
        totalKeywords: 0,
        mostSuggestedArticles: [],
        mostAcceptedArticles: []
      };
    }

    // Estatísticas agregadas
    const aggregates = await prisma.documentAnalysis.aggregate({
      _avg: {
        precision: true,
        totalSuggestions: true,
        acceptedCount: true,
        citationsFound: true,
        keywordsMatched: true
      },
      _sum: {
        citationsFound: true,
        keywordsMatched: true
      }
    });

    // Artigos mais sugeridos
    const analyses = await prisma.documentAnalysis.findMany({
      select: {
        suggestedArticles: true,
        acceptedArticles: true
      }
    });

    // Conta frequência de artigos sugeridos
    const suggestedFreq = new Map<string, number>();
    const acceptedFreq = new Map<string, number>();

    for (const analysis of analyses) {
      const suggested = JSON.parse(analysis.suggestedArticles) as string[];
      for (const article of suggested) {
        suggestedFreq.set(article, (suggestedFreq.get(article) || 0) + 1);
      }

      if (analysis.acceptedArticles) {
        const accepted = JSON.parse(analysis.acceptedArticles) as string[];
        for (const article of accepted) {
          acceptedFreq.set(article, (acceptedFreq.get(article) || 0) + 1);
        }
      }
    }

    // Top 10 mais sugeridos
    const mostSuggested = Array.from(suggestedFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([article, count]) => ({ article, count }));

    // Top 10 mais aceitos
    const mostAccepted = Array.from(acceptedFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([article, count]) => ({ article, count }));

    return {
      totalAnalyses,
      avgPrecision: aggregates._avg.precision || 0,
      avgSuggestions: aggregates._avg.totalSuggestions || 0,
      avgAccepted: aggregates._avg.acceptedCount || 0,
      totalCitations: aggregates._sum.citationsFound || 0,
      totalKeywords: aggregates._sum.keywordsMatched || 0,
      mostSuggestedArticles: mostSuggested,
      mostAcceptedArticles: mostAccepted
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    throw error;
  }
}

/**
 * Obtém análises recentes
 */
export async function getRecentAnalyses(limit = 20) {
  try {
    return await prisma.documentAnalysis.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        documentTitle: true,
        documentType: true,
        totalSuggestions: true,
        acceptedCount: true,
        precision: true,
        citationsFound: true,
        keywordsMatched: true,
        createdAt: true
      }
    });
  } catch (error) {
    console.error('Erro ao buscar análises recentes:', error);
    throw error;
  }
}
