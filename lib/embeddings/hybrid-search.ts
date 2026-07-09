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
import { rerankResults } from './reranker';
import { apiLogger } from '../logger';

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
  /** Quando true (default), exclui Súmulas TST com situação CANCELADA/REVISTA do contexto. */
  excludeInactiveSumulas?: boolean;
  /** Boost por tribunalCode aplicado dentro do ramo TribunalDecisionChunk. Ver vector-search.SearchOptions.tribunalBoost. */
  tribunalBoost?: { code: string; factor: number };
  /** Omite o ramo DocumentChunk no vector search (encaminhado para semanticSearch). */
  skipDocumentBranch?: boolean;
  /** Omite o ramo LegislativeActChunk no vector search (encaminhado para semanticSearch). */
  skipLegislativeActBranch?: boolean;
  /** Filtra o ramo TribunalDecisionChunk por tribunalCode específico (ex.: 'TST'). */
  tribunalCodeFilter?: string;
  /**
   * Pula o ramo Full-Text Search (BM25/tsvector). Quando true, o resultado vem
   * apenas do vector, sem fusão RRF. Útil para scopes de pesquisa que devem
   * permanecer estritamente dentro do conjunto retornado pelo vetor — por
   * exemplo, "Só TST", onde misturar FTS de Document contamina o ranking.
   */
  skipFts?: boolean;
  rerank?: boolean; // Aplicar reranking nos resultados (default: false)
  /** Coluna de vetor a usar (A/B Fase 4.1). Encaminhado para vector-search.SearchOptions. Default 'embedding'. */
  embeddingColumn?: 'embedding' | 'embedding1536';
  /** Dimensão do embedding da query (deve casar com a coluna). Encaminhado para vector-search.SearchOptions. Default 768. */
  queryDimension?: number;
  /**
   * Constante de suavização do Reciprocal Rank Fusion. Default DEFAULT_RRF_K (60,
   * padrão da literatura). Exposto para o sweep de tuning da fusão (BIA-3) —
   * valores menores dão mais peso às primeiras posições, maiores achatam a curva.
   */
  rrfK?: number;
}

export interface HybridSearchResponse {
  results: SearchResult[];
  query: string;
  totalFound: number;
  latency: number;
  cached: boolean;
  /**
   * Maior similaridade de COSINE bruta (0..1) do ramo vetorial, ANTES da fusão
   * RRF. Fase 2.5: o `similarity` dos results é o score RRF (~0.01) após a fusão,
   * incomensurável com um limiar de cosine. Este campo dá o sinal real de
   * "a base tem material semanticamente próximo?" para o banner de cobertura baixa.
   */
  topVectorSimilarity: number;
}

// ===========================
// Constants
// ===========================

export const DEFAULT_RRF_K = 60; // Constante de suavização RRF (padrão na literatura)

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
    excludeInactiveSumulas = true,
    tribunalBoost,
    skipDocumentBranch,
    skipLegislativeActBranch,
    tribunalCodeFilter,
    skipFts = false,
    rerank = false,
    embeddingColumn,
    queryDimension,
    rrfK = DEFAULT_RRF_K,
  } = options;

  const vectorOptions: SearchOptions = {
    courseId,
    category,
    excludeCategories,
    limit: limit * 3,
    useCache,
    includeChunkContent: true,
    includeTribunalDecisions,
    excludeInactiveSumulas,
    tribunalBoost,
    skipDocumentBranch,
    skipLegislativeActBranch,
    tribunalCodeFilter,
    embeddingColumn,
    queryDimension,
  };

  const ftsOptions: DocumentFTSOptions = {
    limit: limit * 3,
    excludeCategories,
  };

  // Executar buscas em paralelo. Quando skipFts, FTS é trocado por array vazio
  // (RRF degenera para ranking puramente vetorial).
  const [vectorResults, ftsResults] = await Promise.all([
    expandedQueries && expandedQueries.length > 1
      ? multiQuerySearch(expandedQueries, vectorOptions)
          .then(results => ({ results, query, totalFound: results.length, latency: 0, cached: false }))
      : semanticSearch(query, vectorOptions),
    skipFts
      ? Promise.resolve([])
      : searchDocuments(query, ftsOptions).catch((err) => {
          // FTS pode falhar por timeout, índice GIN corrompido, ou vacuum atrasado.
          // Caímos para semantic-only (degradação graciosa) mas logamos para não
          // mascarar problemas reais de Postgres.
          apiLogger.warn(
            { err, queryPreview: query.slice(0, 200) },
            'hybrid-search: FTS failed, falling back to semantic-only'
          );
          return [];
        }),
  ]);

  // Mapear rankings vetoriais (documentId → rank)
  const vectorRanks = new Map<string, number>();
  const vectorResultMap = new Map<string, SearchResult>();
  vectorResults.results.forEach((r, i) => {
    vectorRanks.set(r.documentId, i + 1);
    vectorResultMap.set(r.documentId, r);
  });

  // Fase 2.5: maior cosine bruto (semanticSearch retorna ordenado por cosine
  // desc, então o 1º é o teto). Capturado ANTES do RRF sobrescrever `similarity`.
  const topVectorSimilarity = vectorResults.results[0]?.similarity ?? 0;

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

    const vectorScore = vRank ? alpha / (rrfK + vRank) : 0;
    const ftsScore = fRank ? (1 - alpha) / (rrfK + fRank) : 0;

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

  // Reranking opcional (Gemini Flash avalia relevância semântica)
  // Passa topK=limit para que o reranker reordene e corte ao tamanho final
  const finalResults = rerank
    ? await rerankResults(query, results, limit)
    : results;

  return {
    results: finalResults,
    query,
    totalFound: finalResults.length,
    latency: Date.now() - startTime,
    cached: false,
    topVectorSimilarity,
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
