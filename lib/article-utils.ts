/**
 * Utilidades para trabalhar com artigos da Lei 14.133/2021
 * Fase 1 MVP: Sistema de busca e catalogação por artigos
 */

import { LEI_14133_ARTIGOS, type LeiArticle } from '@/data/lei-14133-artigos';
import { prisma } from '@/lib/prisma';

/**
 * Extrai números de artigos de um documento
 */
export function extractArticleNumbers(leiArticlesJson: string | null): string[] {
  if (!leiArticlesJson) return [];

  try {
    const parsed = JSON.parse(leiArticlesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Formata número de artigo para exibição
 */
export function formatArticleNumber(numero: string): string {
  return `Art. ${numero}`;
}

/**
 * Formata artigo completo (número + ementa resumida)
 */
export function formatArticleShort(numero: string): string {
  const article = LEI_14133_ARTIGOS[numero];
  if (!article) return formatArticleNumber(numero);

  // Pega primeiras 50 caracteres da ementa
  const shortEmenta = article.ementa.length > 50
    ? article.ementa.substring(0, 50) + '...'
    : article.ementa;

  return `${formatArticleNumber(numero)} - ${shortEmenta}`;
}

/**
 * Obtém dados completos de um artigo
 */
export function getArticleData(numero: string): LeiArticle | null {
  return LEI_14133_ARTIGOS[numero] || null;
}

/**
 * Busca artigos por termo (para autocomplete)
 */
export function searchArticles(searchTerm: string, limit: number = 10): LeiArticle[] {
  if (!searchTerm || searchTerm.length < 1) return [];

  const term = searchTerm.toLowerCase().trim();
  const results: LeiArticle[] = [];

  // Busca exata por número primeiro
  if (/^\d+$/.test(term)) {
    const article = LEI_14133_ARTIGOS[term];
    if (article) {
      results.push(article);
    }
  }

  // Busca por números que começam com o termo
  if (results.length < limit) {
    Object.values(LEI_14133_ARTIGOS).forEach(article => {
      if (article.numero.startsWith(term) && !results.find(r => r.numero === article.numero)) {
        results.push(article);
      }
    });
  }

  // Busca na ementa
  if (results.length < limit) {
    Object.values(LEI_14133_ARTIGOS).forEach(article => {
      if (
        article.ementa.toLowerCase().includes(term) &&
        !results.find(r => r.numero === article.numero)
      ) {
        results.push(article);
      }
    });
  }

  return results.slice(0, limit);
}

/**
 * Obtém cor do badge por seção da lei (para UI)
 */
export function getArticleColor(numero: string): string {
  const num = parseInt(numero);

  // Cores por seção conforme proposta
  if (num >= 1 && num <= 17) return 'blue';      // Disposições Gerais
  if (num >= 18 && num <= 71) return 'green';    // Licitações
  if (num >= 72 && num <= 88) return 'yellow';   // Contratação Direta + Aux
  if (num >= 89 && num <= 154) return 'orange';  // Contratos
  if (num >= 155 && num <= 173) return 'red';    // Sanções
  if (num >= 174 && num <= 193) return 'purple'; // Instrumentos Auxiliares + Finais

  return 'gray'; // Fallback
}

/**
 * Obtém classes CSS do badge baseado na cor
 */
export function getArticleBadgeClasses(numero: string, isPrimary: boolean = false): string {
  const color = getArticleColor(numero);
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';

  if (isPrimary) {
    // Badge de artigo principal (mais destacado)
    const colorClasses = {
      blue: 'bg-blue-600 text-white',
      green: 'bg-green-600 text-white',
      yellow: 'bg-yellow-600 text-white',
      orange: 'bg-orange-600 text-white',
      red: 'bg-red-600 text-white',
      purple: 'bg-purple-600 text-white',
      gray: 'bg-gray-600 text-white',
    };
    return `${base} ${colorClasses[color as keyof typeof colorClasses]}`;
  } else {
    // Badge de artigo relacionado (mais suave)
    const colorClasses = {
      blue: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      green: 'bg-green-100 text-green-800 hover:bg-green-200',
      yellow: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
      orange: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
      red: 'bg-red-100 text-red-800 hover:bg-red-200',
      purple: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
      gray: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    };
    return `${base} ${colorClasses[color as keyof typeof colorClasses]} cursor-pointer transition-colors`;
  }
}

/**
 * Analytics: Conta quantos documentos existem por artigo
 */
export async function getDocumentCountByArticle(): Promise<Record<string, number>> {
  const documents = await prisma.document.findMany({
    where: {
      leiArticles: { not: null },
    },
    select: {
      leiArticles: true,
    },
  });

  const counts: Record<string, number> = {};

  documents.forEach(doc => {
    const articles = extractArticleNumbers(doc.leiArticles);
    articles.forEach(articleNum => {
      counts[articleNum] = (counts[articleNum] || 0) + 1;
    });
  });

  return counts;
}

/**
 * Analytics: Top N artigos mais consultados (baseado em AccessLog)
 */
export async function getTopArticles(limit: number = 10): Promise<Array<{
  numero: string;
  article: LeiArticle;
  documentCount: number;
  viewCount: number;
}>> {
  // Primeiro pega contagem de documentos por artigo
  const docCounts = await getDocumentCountByArticle();

  // Depois pega visualizações de documentos com artigos
  const viewLogs = await prisma.accessLog.findMany({
    where: {
      action: { in: ['view', 'download'] },
      documentId: { not: null },
    },
    select: {
      documentId: true,
    },
  });

  // Mapeia documentId → contagem de views
  const docViews: Record<string, number> = {};
  viewLogs.forEach(log => {
    if (log.documentId) {
      docViews[log.documentId] = (docViews[log.documentId] || 0) + 1;
    }
  });

  // Pega documentos com leiArticles
  const documents = await prisma.document.findMany({
    where: {
      leiArticles: { not: null },
    },
    select: {
      id: true,
      leiArticles: true,
    },
  });

  // Conta views por artigo
  const articleViews: Record<string, number> = {};
  documents.forEach(doc => {
    const articles = extractArticleNumbers(doc.leiArticles);
    const views = docViews[doc.id] || 0;
    articles.forEach(articleNum => {
      articleViews[articleNum] = (articleViews[articleNum] || 0) + views;
    });
  });

  // Combina tudo e ordena
  const results = Object.entries(docCounts).map(([numero, count]) => ({
    numero,
    article: LEI_14133_ARTIGOS[numero],
    documentCount: count,
    viewCount: articleViews[numero] || 0,
  })).filter(item => item.article); // Remove artigos não encontrados

  // Ordena por views primeiro, depois por quantidade de docs
  results.sort((a, b) => {
    if (b.viewCount !== a.viewCount) {
      return b.viewCount - a.viewCount;
    }
    return b.documentCount - a.documentCount;
  });

  return results.slice(0, limit);
}

/**
 * Valida se um número de artigo existe
 */
export function isValidArticle(numero: string): boolean {
  return !!LEI_14133_ARTIGOS[numero];
}

/**
 * Obtém ícone contextual baseado na seção do artigo
 */
export function getArticleIcon(numero: string): string {
  const num = parseInt(numero);

  if (num >= 1 && num <= 17) return '📋';      // Disposições Gerais
  if (num >= 18 && num <= 71) return '🏛️';    // Licitações
  if (num >= 72 && num <= 88) return '⚡';     // Contratação Direta
  if (num >= 89 && num <= 154) return '📝';   // Contratos
  if (num >= 155 && num <= 173) return '⚖️';  // Sanções
  if (num >= 174 && num <= 193) return '🔧';  // Instrumentos

  return '📄';
}
