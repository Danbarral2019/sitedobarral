/**
 * Tipos do módulo de auditoria do golden set (Fase 6).
 */

/** Nome de lista onde um doc pode entrar. */
export type AnnotationList = 'relevant' | 'highly'

/** Linha bruta do CSV de auditoria (6B passo 1). */
export interface AuditCandidate {
  queryId: string
  queryText: string
  candidateId: string
  candidateTitle: string
  candidatePosition: number // 1-indexed no top-N
  candidateSnippet: string
  existingRelevantsCount: number
  suggestAuto: 'accept' | 'maybe' | 'reject'
}

/** Valores válidos pra coluna `decision` do CSV. */
export type DecisionValue = '' | 'accept' | 'accept-highly' | 'reject' | 'comment'

/** Linha do CSV após parsing (com decisão humana). */
export interface AuditRow extends AuditCandidate {
  decision: DecisionValue
  decisionNote: string
}

/** Especificação declarativa de uma operação conhecida em 6A. */
export interface KnownOperation {
  queryId: string
  /** Adições por busca de título no DB (fuzzy). Resolvidas em runtime. */
  addByTitle: Array<{ titleQuery: string; list: AnnotationList }>
  /** Adições com ID conhecido (dedup, casos de ID já sabido). */
  addById: Array<{ id: string; list: AnnotationList }>
  /** Remoções com ID conhecido (IDs fantasma, anotações erradas). */
  removeIds: string[]
  /** Descrição pra log/confirmação. */
  description: string
}
