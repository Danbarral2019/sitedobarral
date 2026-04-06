/**
 * Métricas de qualidade de retrieval — funções puras, sem I/O.
 */

/**
 * recall@k = |predicted[0..k] ∩ relevant| / |relevant|
 * Retorna 0 se relevant está vazio (em vez de NaN).
 */
export function recallAtK(predicted: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0
  const topK = predicted.slice(0, k)
  let hits = 0
  for (const id of topK) {
    if (relevant.has(id)) hits++
  }
  return hits / relevant.size
}

/**
 * Reciprocal rank: 1 / (1-based index do primeiro item de `predicted` em `relevant`).
 * Retorna 0 se nenhum item relevante aparece.
 */
export function reciprocalRank(predicted: string[], relevant: Set<string>): number {
  for (let i = 0; i < predicted.length; i++) {
    if (relevant.has(predicted[i])) {
      return 1 / (i + 1)
    }
  }
  return 0
}

/**
 * nDCG@k com gain graduado (highly relevant = 2, relevant = 1, outros = 0).
 * Fórmula DCG: Σ (2^gain - 1) / log₂(i + 2) para i 0-based.
 * Retorna null se IDCG = 0 (sem itens relevantes — não computar para evitar viés no agregado).
 */
export function ndcgAtK(
  predicted: string[],
  relevant: Set<string>,
  highlyRelevant: Set<string>,
  k: number
): number | null {
  const gain = (id: string): number => {
    if (highlyRelevant.has(id)) return 2
    if (relevant.has(id)) return 1
    return 0
  }

  // DCG do ranking previsto
  let dcg = 0
  const topK = predicted.slice(0, k)
  for (let i = 0; i < topK.length; i++) {
    const g = gain(topK[i])
    if (g > 0) {
      dcg += (Math.pow(2, g) - 1) / Math.log2(i + 2)
    }
  }

  // IDCG = DCG do ranking ideal
  const idealGains: number[] = []
  for (const id of highlyRelevant) idealGains.push(2)
  for (const id of relevant) {
    if (!highlyRelevant.has(id)) idealGains.push(1)
  }
  idealGains.sort((a, b) => b - a)

  let idcg = 0
  for (let i = 0; i < Math.min(k, idealGains.length); i++) {
    idcg += (Math.pow(2, idealGains[i]) - 1) / Math.log2(i + 2)
  }

  if (idcg === 0) return null
  return dcg / idcg
}
