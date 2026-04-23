import type { BucketAuto, Signals } from './types'

/**
 * Converte (reciprocalRank, docPositionInTop100) na posição efetiva do
 * primeiro doc relevante no ranking.
 * - Se MRR > 0 → round(1/MRR) (do top-20 que o eval já viu).
 * - Senão, se docPositionInTop100 preenchido → usa direto.
 * - Senão → null (doc fora do top-100).
 */
export function effectivePosition(s: Pick<Signals, 'reciprocalRank' | 'docPositionInTop100'>): number | null {
  if (s.reciprocalRank > 0) return Math.round(1 / s.reciprocalRank)
  if (s.docPositionInTop100 !== null) return s.docPositionInTop100
  return null
}

export interface BucketDecision {
  bucket: BucketAuto
  reason: string
}

/**
 * Classifica uma query falha em um bucket seguindo as 5 regras ordenadas
 * do spec Fase 0. Primeira regra que bate vence.
 */
export function classifyBucket(s: Signals): BucketDecision {
  // Defensive guard: sem docs relevantes, nenhuma regra faz sentido.
  if (s.relevantDocs.length === 0) {
    return { bucket: 'B', reason: 'sem docs relevantes anotados (caso defensivo)' }
  }

  // Regra 1: C / C-parcial — chunks
  const anyWithoutChunks = s.relevantDocs.some((d) => d.chunkCount === 0)
  const allWithoutChunks = s.relevantDocs.every((d) => d.chunkCount === 0)
  if (allWithoutChunks) {
    return { bucket: 'C', reason: 'nenhum doc relevante tem chunks indexados' }
  }
  if (anyWithoutChunks) {
    return {
      bucket: 'C-parcial',
      reason: 'alguns docs relevantes não têm chunks (indexação parcial)',
    }
  }

  // Regra 2: D / D+ — ranking ruim
  const pos = effectivePosition(s)
  if (pos !== null && pos <= 20) {
    if (pos <= 5) {
      return {
        bucket: 'D+',
        reason: `doc relevante em posição ${pos} dentro do top-5 (ranking parcial — outros relevantes faltando)`,
      }
    }
    if (pos <= 10) {
      return {
        bucket: 'D+',
        reason: `doc relevante em posição ${pos} (próximo do top-5)`,
      }
    }
    return {
      bucket: 'D',
      reason: `doc relevante em posição ${pos} (top-20 mas não top-5)`,
    }
  }

  // Regras 3 e 4: A / A' — key terms
  if (s.keyTerms.length > 0) {
    const anyTermInExpected = Object.values(s.keyTermsInExpectedDoc).some(Boolean)
    if (!anyTermInExpected) {
      return {
        bucket: 'A',
        reason: `key terms [${s.keyTerms.join(', ')}] ausentes do content dos docs relevantes`,
      }
    }
    // Termos presentes mas doc longe
    return {
      bucket: "A'",
      reason: 'key terms presentes no doc esperado, mas doc fora do top-100 (FTS deveria ter pego)',
    }
  }

  // Regra 5: B — fallback
  return {
    bucket: 'B',
    reason: 'doc indexado, sem termos específicos na query, vetor não aproxima o bastante',
  }
}
