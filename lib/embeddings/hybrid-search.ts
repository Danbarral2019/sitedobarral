/**
 * Hybrid Search: BM25 (FTS) + Vector (pgvector) com Reciprocal Rank Fusion
 *
 * Combina Full-Text Search (termos exatos, siglas, números de artigos)
 * com busca semântica (similaridade de significado) usando RRF.
 *
 * RRF_score(doc) = alpha/(k + rank_vector) + (1-alpha)/(k + rank_fts)
 */

import { semanticSearch, multiQuerySearch, type SearchResult, type SearchOptions } from './vector-search';
import { searchDocuments, type DocumentFTSOptions } from '../search/full-text-search';

// ===========================
// Types
// ===========================

export interface HybridSearchOptions {
  query: string;
  expandedQueries?: string[];  // Queries expandidas para multiQuerySearch
  courseId?: string;
  category?: string;
  excludeCategories?: string[];
  limit?: number;
  alpha?: number;  // Peso do vetor vs FTS (0.6 = 60% vetor, 40% FTS)
  useCache?: boolean;
  includeTribunalDecisions?: boolean; // Incluir decisoes de TCEs estaduais (default: false)
}

export interface HybridSearchResponse {
  results: SearchResult[];
  query: string;
  totalFound: number;
  latency: number;
  cached: boolean;
}

// ===========================
// Constants
// ===========================

const RRF_K = 60; // Constante de suavização RRF (padrão na literatura)

// ===========================
// Main Function
// ===========================

export async function hybridSearch(
  options: HybridSearchOptions
): Promise<HybridSearchResponse> {
  const startTime = Date.now();
  const {
    query,
    expandedQueries,
    courseId,
    category,
    excludeCategories = [],
    limit = 10,
    alpha = 0.6,
    useCache = true,
    includeTribunalDecisions = false,
  } = options;

  const vectorOptions: SearchOptions = {
    courseId,
    category,
    excludeCategories,
    limit: limit * 3,
    useCache,
    includeChunkContent: true,
    includeTribunalDecisions,
  };

  const ftsOptions: DocumentFTSOptions = {
    limit: limit * 3,
    excludeCategories: [...excludeCategories, 'lei-artigo', 'ato-normativo'],
  };

  // Executar ambas as buscas em paralelo
  const [vectorResults, ftsResults] = await Promise.all([
    expandedQueries && expandedQueries.length > 1
      ? multiQuerySearch(expandedQueries, vectorOptions)
          .then(results => ({ results, query, totalFound: results.length, latency: 0, cached: false }))
      : semanticSearch(query, vectorOptions),
    searchDocuments(query, ftsOptions).catch(() => []),
  ]);

  // Mapear rankings vetoriais (documentId → rank)
  const vectorRanks = new Map<string, number>();
  const vectorResultMap = new Map<string, SearchResult>();
  vectorResults.results.forEach((r, i) => {
    vectorRanks.set(r.documentId, i + 1);
    vectorResultMap.set(r.documentId, r);
  });

  // Mapear rankings FTS (id → rank)
  const ftsRanks = new Map<string, number>();
  ftsResults.forEach((r, i) => {
    ftsRanks.set(r.data.id, i + 1);
  });

  // Todos os doc IDs únicos
  const allDocIds = new Set([
    ...vectorResults.results.map(r => r.documentId),
    ...ftsResults.map(r => r.data.id),
  ]);

  // Calcular RRF scores
  const scored: Array<{ docId: string; score: number }> = [];

  for (const docId of allDocIds) {
    const vRank = vectorRanks.get(docId);
    const fRank = ftsRanks.get(docId);

    const vectorScore = vRank ? alpha / (RRF_K + vRank) : 0;
    const ftsScore = fRank ? (1 - alpha) / (RRF_K + fRank) : 0;

    scored.push({
      docId,
      score: vectorScore + ftsScore,
    });
  }

  // Ordenar por score RRF
  scored.sort((a, b) => b.score - a.score);

  // Montar resultados finais, priorizando dados do vetor (têm chunkContent)
  const results: SearchResult[] = [];
  for (const { docId, score } of scored) {
    if (results.length >= limit) break;

    const vectorResult = vectorResultMap.get(docId);
    if (vectorResult) {
      // Usa dados do vetor (tem chunk content para o prompt)
      results.push({
        ...vectorResult,
        similarity: score,
      });
    } else {
      // Doc só apareceu no FTS — monta resultado mínimo
      const ftsEntry = ftsResults.find(r => r.data.id === docId);
      if (ftsEntry) {
        results.push({
          documentId: ftsEntry.data.id,
          documentTitle: ftsEntry.data.title,
          category: ftsEntry.data.category,
          chunkContent: ftsEntry.data.description || ftsEntry.data.title,
          chunkIndex: 0,
          similarity: score,
          url: ftsEntry.data.url || undefined,
          courseId: ftsEntry.data.course_id || undefined,
          isCommon: false,
          tags: ftsEntry.data.tags ? safeParseArray(ftsEntry.data.tags) : undefined,
          leiArticles: null,
          sourceType: 'document',
        });
      }
    }
  }

  return {
    results,
    query,
    totalFound: results.length,
    latency: Date.now() - startTime,
    cached: false,
  };
}

// ===========================
// Helpers
// ===========================

function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
}
