import { hybridSearch } from '@/lib/embeddings/hybrid-search'
import type { SearchFn } from './types'

/**
 * Adapter que envolve `hybridSearch` na interface SearchFn esperada pelo runner.
 *
 * Decisões:
 * - `limit: 20` — pega top-20 para ter espaço para nDCG@10 e recall@5 sem cortar.
 * - `useCache: false` — eval deve refletir comportamento "frio" do sistema.
 * - Sem filtro de curso/categoria — golden set assume busca global.
 * - Deduplica por documentId mantendo a primeira ocorrência (chunks do mesmo doc
 *   aparecem em sequência; a métrica é por documento, não por chunk).
 * - `alpha: 0.6` — peso padrão do sistema para balanço vetor/FTS (60/40).
 */
export const baselineSearch: SearchFn = async (query: string) => {
  const start = Date.now()
  const response = await hybridSearch({
    query,
    limit: 20,
    alpha: 0.6,
    useCache: false,
  })
  const latencyMs = Date.now() - start

  const seen = new Set<string>()
  const documentIds: string[] = []
  for (const r of response.results) {
    if (!seen.has(r.documentId)) {
      seen.add(r.documentId)
      documentIds.push(r.documentId)
    }
  }

  return { documentIds, latencyMs }
}
