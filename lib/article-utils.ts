/**
 * Utilidades para trabalhar com artigos da Lei 14.133/2021
 *
 * NOTA DE PERFORMANCE: este módulo NÃO importa LEI_14133_ARTIGOS no top-level
 * porque o mapa pesa ~329 KB e seria incluído no bundle de qualquer rota que
 * importasse este arquivo. Funções server-only que precisam do mapa fazem
 * dynamic import internamente. Componentes client devem usar o hook
 * `useLeiArticles()` de `hooks/useLeiArticles.ts`.
 */

import type { LeiArticle } from '@/data/lei-14133-artigos';
import { prisma } from '@/lib/prisma';
import { parseLeiArticles } from './lei-articles';

/**
 * Extrai números de artigos de um documento (campo leiArticles em JSON).
 * Wrapper sobre `parseLeiArticles` mantido por retrocompatibilidade.
 * @deprecated Use `parseLeiArticles` de `@/lib/lei-articles` diretamente.
 */
export function extractArticleNumbers(leiArticlesJson: string | null): string[] {
  return parseLeiArticles(leiArticlesJson);
}

/**
 * Formata número de artigo para exibição
 */
export function formatArticleNumber(numero: string): string {
  return `Art. ${numero}`;
}

/**
 * Obtém cor do badge por seção da lei (para UI)
 */
export function getArticleColor(numero: string): string {
  const num = parseInt(numero);

  if (num >= 1 && num <= 17) return 'blue';      // Disposições Gerais
  if (num >= 18 && num <= 71) return 'green';    // Licitações
  if (num >= 72 && num <= 88) return 'yellow';   // Contratação Direta + Aux
  if (num >= 89 && num <= 154) return 'orange';  // Contratos
  if (num >= 155 && num <= 173) return 'red';    // Sanções
  if (num >= 174 && num <= 193) return 'purple'; // Instrumentos Auxiliares + Finais

  return 'gray';
}

/**
 * Obtém classes CSS do badge baseado na cor
 */
export function getArticleBadgeClasses(numero: string, isPrimary: boolean = false): string {
  const color = getArticleColor(numero);
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';

  if (isPrimary) {
    const colorClasses = {
      blue: 'bg-brand-600 text-white',
      green: 'bg-green-600 text-white',
      yellow: 'bg-amber-accent text-white',
      orange: 'bg-amber-accent text-white',
      red: 'bg-red-600 text-white',
      purple: 'bg-brand-600 text-white',
      gray: 'bg-brand-800 text-white',
    };
    return `${base} ${colorClasses[color as keyof typeof colorClasses]}`;
  } else {
    const colorClasses = {
      blue: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
      green: 'bg-green-100 text-green-800 hover:bg-green-200',
      yellow: 'bg-amber-accent-soft text-amber-accent-deep hover:bg-amber-accent-soft',
      orange: 'bg-amber-accent-soft text-amber-accent-deep hover:bg-amber-accent-soft',
      red: 'bg-red-100 text-red-800 hover:bg-red-200',
      purple: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
      gray: 'bg-surface-deep text-ink-secondary hover:bg-surface-deep',
    };
    return `${base} ${colorClasses[color as keyof typeof colorClasses]} cursor-pointer transition-colors`;
  }
}

/**
 * Obtém ícone contextual baseado na seção do artigo
 */
export function getArticleIcon(numero: string): string {
  const num = parseInt(numero);

  if (num >= 1 && num <= 17) return '📋';
  if (num >= 18 && num <= 71) return '🏛️';
  if (num >= 72 && num <= 88) return '⚡';
  if (num >= 89 && num <= 154) return '📝';
  if (num >= 155 && num <= 173) return '⚖️';
  if (num >= 174 && num <= 193) return '🔧';

  return '📄';
}

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
