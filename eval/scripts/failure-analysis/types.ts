/**
 * Tipos do módulo de análise de falhas do retrieval (Fase 0 do
 * ROADMAP_BUSCA_QUALIDADE). Importados pelo CLI analyze-failures.ts
 * e pelos módulos puros (key-terms, bucket-heuristic, report-format).
 */

export type BucketAuto =
  | 'C'
  | 'C-parcial'
  | 'D'
  | 'D+'
  | 'A'
  | "A'"
  | 'B'

/** Sinais mecânicos coletados por query falha. */
export interface Signals {
  id: string
  query: string
  difficulty: 'easy' | 'medium' | 'hard'
  recallAt5: number
  reciprocalRank: number
  predictedTop20: string[]
  relevantIds: string[]
  highlyRelevantIds: string[]

  // Enriquecimento do DB
  relevantDocs: Array<{
    id: string
    exists: boolean
    title: string | null
    contentLen: number
    chunkCount: number
  }>

  /**
   * Posição do primeiro doc relevante no top-100 quando MRR = 0.
   * null se busca não retornou o doc em 100 resultados (ou se MRR > 0 —
   * neste caso usar round(1/reciprocalRank) para derivar posição).
   */
  docPositionInTop100: number | null

  // Derivados da query
  keyTerms: string[]
  keyTermsInExpectedDoc: Record<string, boolean>
  keyTermsInTop5Docs: Record<string, boolean>

  // Títulos dos top-5 (preenchidos junto com relevantDocs, por id)
  top5Titles: string[]
}

export interface BucketedRow extends Signals {
  bucketAuto: BucketAuto
  bucketReason: string
  /** Preenchido manualmente depois. Começa vazio. */
  bucketManual: string
}

export interface FailureAnalysisReport {
  sourceRunPath: string
  scopeDescription: string
  generatedAt: string
  rows: BucketedRow[]
}
