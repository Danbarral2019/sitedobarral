import { hybridSearch } from '@/lib/embeddings/hybrid-search'
import { understandQuery } from '@/lib/embeddings/query-understanding'
import type { SearchFn } from './types'

/** Deduplica resultados por documentId mantendo a primeira ocorrência */
function dedup(results: { documentId: string }[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const r of results) {
    if (!seen.has(r.documentId)) {
      seen.add(r.documentId)
      ids.push(r.documentId)
    }
  }
  return ids
}

/**
 * Adapter baseline: hybridSearch sem reranking.
 *
 * - `limit: 20` — espaço para nDCG@10 e recall@5.
 * - `useCache: false` — eval reflete comportamento "frio".
 * - `alpha: 0.6` — balanço padrão vetor/FTS (60/40).
 */
export const baselineSearch: SearchFn = async (query: string) => {
  const start = Date.now()
  const response = await hybridSearch({
    query,
    limit: 20,
    alpha: 0.6,
    useCache: false,
  })
  return { documentIds: dedup(response.results), latencyMs: Date.now() - start }
}

/**
 * Adapter A/B Fase 4.1: hybridSearch usando a coluna shadow embedding1536.
 * Mesmos parâmetros do baseline (limit 20, alpha 0.6, sem cache) para
 * isolar a variável "dimensão do embedding".
 */
export const shadowSearch1536: SearchFn = async (query: string) => {
  const start = Date.now()
  const response = await hybridSearch({
    query,
    limit: 20,
    alpha: 0.6,
    useCache: false,
    embeddingColumn: 'embedding1536',
    queryDimension: 1536,
  })
  return { documentIds: dedup(response.results), latencyMs: Date.now() - start }
}

/**
 * Adapter com reranking Gemini: hybridSearch + rerankResults.
 * Pede 40 resultados do RRF para que o reranker tenha candidatos suficientes
 * para reordenar e cortar nos top 20.
 */
export const rerankSearch: SearchFn = async (query: string) => {
  const start = Date.now()
  const response = await hybridSearch({
    query,
    limit: 40,
    alpha: 0.6,
    useCache: false,
    rerank: true,
  })
  return { documentIds: dedup(response.results), latencyMs: Date.now() - start }
}

/**
 * Adapter com query understanding (HyDE + expanded queries), sem reranking.
 * Analisa a query, gera documentos hipotéticos e queries expandidas,
 * depois combina tudo via multiQuerySearch. Reranking desligado desde
 * 2026-04-23 (Fase 2 provou regressão, ver ROADMAP_BUSCA_QUALIDADE.md).
 */
export const hydeSearch: SearchFn = async (query: string) => {
  const start = Date.now()
  const understanding = await understandQuery(query)

  // Combinar: query original + HyDE documents + expanded queries
  const allQueries = [
    query,
    ...understanding.hydeDocuments,
    ...understanding.expandedQueries,
  ].filter(Boolean)

  const response = await hybridSearch({
    query,
    expandedQueries: allQueries.length > 1 ? allQueries : undefined,
    limit: 40,
    alpha: 0.6,
    useCache: false,
    rerank: false,
  })
  return { documentIds: dedup(response.results), latencyMs: Date.now() - start }
}
