/**
 * API endpoint para analytics de análises automáticas de documentos
 *
 * GET /api/admin/analytics/document-analysis
 * Agrega dados reais de leiArticles em Document, LegislativeAct e DOUStagingDocument
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeParseArray } from '@/lib/utils';

export async function GET() {
  try {
    // Buscar todos os documentos que têm leiArticles (foram analisados pela IA)
    const [documents, legislativeActs] = await Promise.all([
      prisma.document.findMany({
        where: { leiArticles: { not: null } },
        select: {
          id: true,
          title: true,
          category: true,
          leiArticles: true,
          updatedAt: true,
        },
      }),
      prisma.legislativeAct.findMany({
        where: { leiArticles: { not: null } },
        select: {
          id: true,
          title: true,
          type: true,
          leiArticles: true,
          updatedAt: true,
        },
      }),
    ]);

    // Unificar todos os itens analisados
    interface AnalyzedItem {
      id: string;
      title: string;
      source: string;
      category: string;
      articles: string[];
      updatedAt: Date;
    }

    const allItems: AnalyzedItem[] = [
      ...documents.map(d => ({
        id: d.id,
        title: d.title,
        source: 'Document' as const,
        category: d.category || 'outro',
        articles: safeParseArray(d.leiArticles),
        updatedAt: d.updatedAt,
      })),
      ...legislativeActs.map(la => ({
        id: la.id,
        title: la.title,
        source: 'LegislativeAct' as const,
        category: la.type || 'legislacao',
        articles: safeParseArray(la.leiArticles),
        updatedAt: la.updatedAt,
      })),
    ].filter(item => item.articles.length > 0);

    // Estatísticas gerais
    const totalAnalyzed = allItems.length;
    const totalArticleRefs = allItems.reduce((sum, item) => sum + item.articles.length, 0);
    const avgArticlesPerDoc = totalAnalyzed > 0
      ? Math.round((totalArticleRefs / totalAnalyzed) * 10) / 10
      : 0;

    // Frequência de artigos (top 20)
    const articleFreq = new Map<string, number>();
    for (const item of allItems) {
      for (const art of item.articles) {
        articleFreq.set(art, (articleFreq.get(art) || 0) + 1);
      }
    }
    const topArticles = Array.from(articleFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([article, count]) => ({ article, count }));

    // Breakdown por categoria
    const categoryMap = new Map<string, number>();
    for (const item of allItems) {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
    }
    const byCategory = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));

    // Breakdown por fonte
    const sourceMap = new Map<string, number>();
    for (const item of allItems) {
      sourceMap.set(item.source, (sourceMap.get(item.source) || 0) + 1);
    }
    const bySource = Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }));

    // Análises recentes (últimas 30)
    const recentAnalyses = allItems
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 30)
      .map(item => ({
        id: item.id,
        title: item.title,
        source: item.source,
        category: item.category,
        articleCount: item.articles.length,
        articles: item.articles.slice(0, 5),
        updatedAt: item.updatedAt.toISOString(),
      }));

    return NextResponse.json({
      success: true,
      stats: {
        totalAnalyzed,
        totalArticleRefs,
        avgArticlesPerDoc,
        uniqueArticles: articleFreq.size,
        topArticles,
        byCategory,
        bySource,
      },
      recentAnalyses,
    });
  } catch (error) {
    console.error('Erro ao buscar analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao buscar analytics',
      },
      { status: 500 }
    );
  }
}
