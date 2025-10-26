import { DocumentType, SearchFilters } from '@/hooks/use-search';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

/**
 * Remove acentos de uma string para busca case-insensitive
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica se um documento corresponde ao termo de busca
 */
export function matchesSearchTerm(doc: DocumentType, searchTerm: string): boolean {
  if (!searchTerm.trim()) return true;

  const normalizedTerm = normalizeText(searchTerm);

  // Busca em título
  if (normalizeText(doc.title).includes(normalizedTerm)) return true;

  // Busca em descrição
  if (doc.description && normalizeText(doc.description).includes(normalizedTerm)) return true;

  // Busca em tags
  if (doc.tags && normalizeText(doc.tags).includes(normalizedTerm)) return true;

  // Busca em categoria
  if (normalizeText(doc.category).includes(normalizedTerm)) return true;

  // Busca em artigos da Lei 14.133/2021
  if (doc.leiArticles) {
    try {
      const docArticles: string[] = JSON.parse(doc.leiArticles);
      // Busca no número do artigo (ex: "artigo 72", "art 72", "72")
      if (normalizedTerm.match(/\d+/)) {
        const searchNumber = normalizedTerm.match(/\d+/)?.[0];
        if (searchNumber && docArticles.includes(searchNumber)) return true;
      }
      // Busca na ementa dos artigos
      for (const articleNum of docArticles) {
        const article = LEI_14133_ARTIGOS[articleNum];
        if (article && normalizeText(article.ementa).includes(normalizedTerm)) return true;
      }
    } catch {
      // Ignora erros de parse
    }
  }

  return false;
}

/**
 * Aplica filtros a um documento
 */
export function matchesFilters(
  doc: DocumentType,
  filters: SearchFilters,
  favoriteIds: string[] = []
): boolean {
  // Filtro por curso
  if (filters.courseIds.length > 0 && doc.courseId) {
    if (!filters.courseIds.includes(doc.courseId)) return false;
  }

  // Filtro por categoria
  if (filters.categories.length > 0) {
    if (!filters.categories.includes(doc.category)) return false;
  }

  // Filtro por tipo
  if (filters.types.length > 0) {
    if (!filters.types.includes(doc.type)) return false;
  }

  // Filtro por artigos da Lei 14.133/2021
  if (filters.leiArticles.length > 0) {
    if (!doc.leiArticles) return false;

    try {
      const docArticles: string[] = JSON.parse(doc.leiArticles);
      // Verifica se o documento tem pelo menos um dos artigos selecionados
      const hasMatchingArticle = filters.leiArticles.some(filterArticle =>
        docArticles.includes(filterArticle)
      );
      if (!hasMatchingArticle) return false;
    } catch {
      // Se não conseguir fazer parse, o documento não passa no filtro
      return false;
    }
  }

  // Filtro por data
  if (filters.dateRange !== 'all' && doc.uploadedAt) {
    const uploadDate = new Date(doc.uploadedAt);
    const now = new Date();

    switch (filters.dateRange) {
      case '7days':
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (uploadDate < sevenDaysAgo) return false;
        break;
      case '30days':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (uploadDate < thirtyDaysAgo) return false;
        break;
      case '90days':
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (uploadDate < ninetyDaysAgo) return false;
        break;
      case 'custom':
        if (filters.customDateStart && uploadDate < filters.customDateStart) return false;
        if (filters.customDateEnd && uploadDate > filters.customDateEnd) return false;
        break;
    }
  }

  // Filtro por favoritos
  if (filters.favoritesOnly) {
    if (!favoriteIds.includes(doc.id)) return false;
  }

  return true;
}

/**
 * Calcula score de relevância baseado no termo de busca
 */
export function calculateRelevanceScore(doc: DocumentType, searchTerm: string): number {
  if (!searchTerm.trim()) return 0;

  const normalizedTerm = normalizeText(searchTerm);
  let score = 0;

  // Pontuação por match no título (peso maior)
  const titleMatches = (normalizeText(doc.title).match(new RegExp(normalizedTerm, 'g')) || []).length;
  score += titleMatches * 10;

  // Pontuação por match na descrição
  if (doc.description) {
    const descMatches = (normalizeText(doc.description).match(new RegExp(normalizedTerm, 'g')) || []).length;
    score += descMatches * 3;
  }

  // Pontuação por match nas tags
  if (doc.tags) {
    const tagsMatches = (normalizeText(doc.tags).match(new RegExp(normalizedTerm, 'g')) || []).length;
    score += tagsMatches * 5;
  }

  // Pontuação por match em artigos da Lei 14.133/2021
  if (doc.leiArticles) {
    try {
      const docArticles: string[] = JSON.parse(doc.leiArticles);
      // Bonus se buscar por número de artigo e encontrar match
      if (normalizedTerm.match(/\d+/)) {
        const searchNumber = normalizedTerm.match(/\d+/)?.[0];
        if (searchNumber && docArticles.includes(searchNumber)) {
          score += 15; // Boost forte para match exato de artigo
        }
      }
      // Bonus por match na ementa dos artigos
      for (const articleNum of docArticles) {
        const article = LEI_14133_ARTIGOS[articleNum];
        if (article && normalizeText(article.ementa).includes(normalizedTerm)) {
          score += 3;
        }
      }
    } catch {
      // Ignora erros de parse
    }
  }

  // Bonus se o termo aparece no início do título
  if (normalizeText(doc.title).startsWith(normalizedTerm)) {
    score += 20;
  }

  return score;
}

/**
 * Ordena documentos baseado no critério de ordenação
 */
export function sortDocuments(
  documents: DocumentType[],
  sortBy: SearchFilters['sortBy'],
  searchTerm: string = ''
): DocumentType[] {
  const sorted = [...documents];

  switch (sortBy) {
    case 'relevance':
      return sorted.sort((a, b) => {
        const scoreA = calculateRelevanceScore(a, searchTerm);
        const scoreB = calculateRelevanceScore(b, searchTerm);
        return scoreB - scoreA;
      });

    case 'newest':
      return sorted.sort((a, b) => {
        const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return dateB - dateA;
      });

    case 'oldest':
      return sorted.sort((a, b) => {
        const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return dateA - dateB;
      });

    case 'az':
      return sorted.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

    case 'za':
      return sorted.sort((a, b) => b.title.localeCompare(a.title, 'pt-BR'));

    default:
      return sorted;
  }
}

/**
 * Aplica busca e filtros completos
 */
export function searchAndFilterDocuments(
  documents: DocumentType[],
  searchTerm: string,
  filters: SearchFilters,
  favoriteIds: string[] = []
): DocumentType[] {
  // Primeiro filtra por termo de busca
  let results = documents.filter(doc => matchesSearchTerm(doc, searchTerm));

  // Depois aplica filtros adicionais
  results = results.filter(doc => matchesFilters(doc, filters, favoriteIds));

  // Por fim ordena
  results = sortDocuments(results, filters.sortBy, searchTerm);

  return results;
}

/**
 * Destaca termos de busca em um texto (para UI)
 */
export function highlightSearchTerms(text: string, searchTerm: string): string {
  if (!searchTerm.trim()) return text;

  const normalizedTerm = normalizeText(searchTerm);
  const regex = new RegExp(`(${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

  // Retorna o texto com marcações para highlight
  return text.replace(regex, '<mark>$1</mark>');
}
