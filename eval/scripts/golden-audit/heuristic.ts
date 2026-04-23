import { matchKeyTermsInText } from '../failure-analysis/key-terms'

/**
 * Classifica um candidato à anotação como "accept" | "maybe" | "reject"
 * com base em posição no ranking e overlap de key-terms.
 *
 * Regras:
 * - position ≤ 5 E algum key-term bate em title OU content → accept
 * - position ≤ 5 sem match (OU sem key-terms extraídos) → maybe
 * - position 6..10 E algum key-term bate → maybe
 * - senão → reject
 */
export function classifyCandidate(args: {
  position: number
  candidateTitle: string
  candidateContent: string
  keyTerms: string[]
}): 'accept' | 'maybe' | 'reject' {
  const { position, candidateTitle, candidateContent, keyTerms } = args
  const hasKeyTerms = keyTerms.length > 0
  const titleHits = matchKeyTermsInText(keyTerms, candidateTitle)
  const contentHits = matchKeyTermsInText(keyTerms, candidateContent)
  const anyMatch = keyTerms.some((t) => titleHits[t] || contentHits[t])

  if (position <= 5) {
    if (hasKeyTerms && anyMatch) return 'accept'
    return 'maybe'
  }
  if (position <= 10) {
    if (hasKeyTerms && anyMatch) return 'maybe'
    return 'reject'
  }
  return 'reject'
}
