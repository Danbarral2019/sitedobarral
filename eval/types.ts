/**
 * Tipos do framework de avaliação de busca.
 * Não imports — tipos puros para serem reutilizados por metrics, runner e CLIs.
 */

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GoldenAnnotations {
  /** documentIds considerados relevantes (grade 1). */
  relevant: string[]
  /** Subset de `relevant`, marcados como a melhor resposta (grade 2). */
  highlyRelevant: string[]
  /** ISO date string ou null se ainda não anotada. */
  annotatedAt: string | null
  annotatedBy: string | null
  /** Anotações livres do curador. */
  notes: string
}

export interface GoldenQuery {
  id: string
  query: string
  description: string
  category: string
  difficulty: Difficulty
  annotations: GoldenAnnotations
}

export interface GoldenSet {
  version: 1
  createdAt: string
  queries: GoldenQuery[]
}

/** Resultado de uma única query avaliada. */
export interface QueryEvalResult {
  id: string
  query: string
  difficulty: Difficulty
  predicted: string[]
  recallAt5: number
  recallAt10: number
  /**
   * recall@5 contra o alvo PRIMÁRIO (highlyRelevant, grade 2 = "melhores
   * respostas" do curador). null quando a query não tem highlyRelevant
   * marcado — nesse caso não há alvo primário definido e ela é ignorada no
   * agregado (mesmo tratamento do nDCG com IDCG=0). Métrica não-capada para as
   * queries super-anotadas (BIA-4b): mede se o essencial entra no top-5.
   */
  recallAt5Primary: number | null
  reciprocalRank: number
  ndcgAt10: number | null // null se IDCG = 0 (skipped no agregado)
  latencyMs: number
}

/** Sumário agregado sobre múltiplas queries. */
export interface MetricSummary {
  queriesTotal: number
  queriesAnnotated: number
  queriesSkipped: number
  recallAt5_avg: number
  recallAt10_avg: number
  /** Média de recallAt5Primary sobre as queries que têm alvo primário (highlyRelevant não vazio). */
  recallAt5Primary_avg: number
  /** Quantas queries entraram no cálculo de recallAt5Primary_avg. */
  primaryTargetQueries: number
  mrr: number
  ndcgAt10_avg: number
  byDifficulty: Record<Difficulty, {
    count: number
    recallAt5_avg: number
    recallAt10_avg: number
    mrr: number
    ndcgAt10_avg: number
  }>
}

export interface EvalRun {
  runAt: string
  gitSha: string
  summary: MetricSummary
  perQuery: QueryEvalResult[]
}

/** Função que recebe uma query e devolve documentIds em ordem de ranking. */
export type SearchFn = (query: string) => Promise<{
  documentIds: string[]
  latencyMs: number
}>
