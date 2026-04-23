// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { classifyCandidate } from '@/eval/scripts/golden-audit/heuristic'

describe('classifyCandidate', () => {
  it('accept: top-5 e pelo menos 1 key-term bate em title', () => {
    expect(
      classifyCandidate({
        position: 3,
        candidateTitle: 'Acórdão TCU 2391/2025 - Aditivo - Limite',
        candidateContent: 'blah',
        keyTerms: ['2391/2025'],
      })
    ).toBe('accept')
  })

  it('accept: top-5 e key-term bate em content', () => {
    expect(
      classifyCandidate({
        position: 1,
        candidateTitle: 'Inf. ruim',
        candidateContent: 'artigo 125 da Lei 14.133/2021 aplica-se',
        keyTerms: ['14.133/2021', 'art. 125'],
      })
    ).toBe('accept')
  })

  it('maybe: top-5 sem match de key-term', () => {
    expect(
      classifyCandidate({
        position: 4,
        candidateTitle: 'Inf. sobre algo',
        candidateContent: 'texto qualquer',
        keyTerms: ['14.133/2021'],
      })
    ).toBe('maybe')
  })

  it('maybe: top-6..10 com match de key-term', () => {
    expect(
      classifyCandidate({
        position: 8,
        candidateTitle: 'Inf. sobre 14.133/2021',
        candidateContent: 'blah',
        keyTerms: ['14.133/2021'],
      })
    ).toBe('maybe')
  })

  it('reject: top-6..10 sem match de key-term', () => {
    expect(
      classifyCandidate({
        position: 8,
        candidateTitle: 'Inf. genérico',
        candidateContent: 'texto',
        keyTerms: ['14.133/2021'],
      })
    ).toBe('reject')
  })

  it('maybe: query sem key-terms extraídos e candidato em top-5', () => {
    // Quando keyTerms está vazio, não há como bater — cai em maybe pra top-5
    expect(
      classifyCandidate({
        position: 2,
        candidateTitle: 'qualquer',
        candidateContent: 'conteúdo',
        keyTerms: [],
      })
    ).toBe('maybe')
  })

  it('reject: query sem key-terms e top-6+', () => {
    expect(
      classifyCandidate({
        position: 7,
        candidateTitle: 'qualquer',
        candidateContent: 'conteúdo',
        keyTerms: [],
      })
    ).toBe('reject')
  })
})
