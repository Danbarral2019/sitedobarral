import { hybridSearch } from '@/lib/embeddings/hybrid-search'
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
