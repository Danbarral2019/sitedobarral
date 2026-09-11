/**
 * Analytics dos artigos da Lei 14.133/2021 (server-only: fala com o Prisma).
 *
 * Separado de `lib/article-utils.ts` porque aquele módulo é importado por
 * componentes de cliente — e o import do Prisma lá levava o PrismaClient
 * inteiro para o navegador (ver issue #212).
 *
 * NOTA DE PERFORMANCE: não importa LEI_14133_ARTIGOS no top-level (~329 KB);
 * `getTopArticles` faz dynamic import.
 */

import type { LeiArticle } from '@/data/lei-14133-artigos';
import { prisma } from '@/lib/prisma';

/**
 * Analytics (server-only): conta documentos por artigo
 */
export async function getDocumentCountByArticle(): Promise<Record<string, number>> {
  const documents = await prisma.document.findMany({
    where: { leiArticlesArr: { isEmpty: false } },
    select: { leiArticlesArr: true },
  });

  const counts: Record<string, number> = {};
  documents.forEach(doc => {
    doc.leiArticlesArr.forEach(articleNum => {
      counts[articleNum] = (counts[articleNum] || 0) + 1;
    });
  });

  return counts;
}

/**
 * Analytics (server-only): top N artigos mais consultados.
 * Carrega LEI_14133_ARTIGOS dinamicamente para não inflar bundle.
 */
export async function getTopArticles(limit: number = 10): Promise<Array<{
  numero: string;
  article: LeiArticle;
  documentCount: number;
  viewCount: number;
}>> {
  const { LEI_14133_ARTIGOS } = await import('@/data/lei-14133-artigos');

  const docCounts = await getDocumentCountByArticle();

  const viewLogs = await prisma.accessLog.findMany({
    where: {
      action: { in: ['view', 'download'] },
      documentId: { not: null },
    },
    select: { documentId: true },
  });

  const docViews: Record<string, number> = {};
  viewLogs.forEach(log => {
    if (log.documentId) {
      docViews[log.documentId] = (docViews[log.documentId] || 0) + 1;
    }
  });

  const documents = await prisma.document.findMany({
    where: { leiArticlesArr: { isEmpty: false } },
    select: { id: true, leiArticlesArr: true },
  });

  const articleViews: Record<string, number> = {};
  documents.forEach(doc => {
    const views = docViews[doc.id] || 0;
    doc.leiArticlesArr.forEach(articleNum => {
      articleViews[articleNum] = (articleViews[articleNum] || 0) + views;
    });
  });

  const results = Object.entries(docCounts).map(([numero, count]) => ({
    numero,
    article: LEI_14133_ARTIGOS[numero],
    documentCount: count,
    viewCount: articleViews[numero] || 0,
  })).filter(item => item.article);

  results.sort((a, b) => {
    if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount;
    return b.documentCount - a.documentCount;
  });

  return results.slice(0, limit);
}
