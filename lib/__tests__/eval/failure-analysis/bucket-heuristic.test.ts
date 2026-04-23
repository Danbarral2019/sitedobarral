// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { classifyBucket, effectivePosition } from '@/eval/scripts/failure-analysis/bucket-heuristic'
import type { Signals } from '@/eval/scripts/failure-analysis/types'

function baseSignals(overrides: Partial<Signals> = {}): Signals {
  return {
    id: 'q-test',
    query: 'teste',
    difficulty: 'medium',
    recallAt5: 0,
    reciprocalRank: 0,
    predictedTop20: [],
    relevantIds: ['d1'],
    highlyRelevantIds: [],
    relevantDocs: [{ id: 'd1', exists: true, title: 'T', contentLen: 500, chunkCount: 5 }],
    docPositionInTop100: null,
    keyTerms: [],
    keyTermsInExpectedDoc: {},
    keyTermsInTop5Docs: {},
    top5Titles: [],
    ...overrides,
  }
}

describe('effectivePosition', () => {
  it('usa 1/reciprocalRank quando MRR > 0', () => {
    expect(effectivePosition({ reciprocalRank: 0.1, docPositionInTop100: null } as Signals)).toBe(10)
    expect(effectivePosition({ reciprocalRank: 0.167, docPositionInTop100: null } as Signals)).toBe(6)
  })

  it('usa docPositionInTop100 quando MRR = 0', () => {
    expect(effectivePosition({ reciprocalRank: 0, docPositionInTop100: 47 } as Signals)).toBe(47)
  })

  it('retorna null se ambos ausentes', () => {
    expect(effectivePosition({ reciprocalRank: 0, docPositionInTop100: null } as Signals)).toBeNull()
  })
})

describe('classifyBucket — Regra 1 (C)', () => {
  it('bucket C quando nenhum relevante tem chunks', () => {
    const s = baseSignals({
      relevantDocs: [{ id: 'd1', exists: true, title: 'T', contentLen: 500, chunkCount: 0 }],
    })
    const { bucket, reason } = classifyBucket(s)
    expect(bucket).toBe('C')
    expect(reason).toMatch(/chunk/i)
  })

  it('bucket C-parcial quando alguns têm chunks, outros não', () => {
    const s = baseSignals({
      relevantIds: ['d1', 'd2'],
      relevantDocs: [
        { id: 'd1', exists: true, title: 'T1', contentLen: 500, chunkCount: 5 },
        { id: 'd2', exists: true, title: 'T2', contentLen: 500, chunkCount: 0 },
      ],
    })
    expect(classifyBucket(s).bucket).toBe('C-parcial')
  })
})

describe('classifyBucket — Regra 2 (D/D+)', () => {
  it('bucket D quando MRR > 0 com posição 11-20', () => {
    const s = baseSignals({ reciprocalRank: 1 / 12 })
    const { bucket } = classifyBucket(s)
    expect(bucket).toBe('D')
  })

  it('bucket D+ quando posição efetiva ≤ 10', () => {
    const s = baseSignals({ reciprocalRank: 1 / 8 })
    expect(classifyBucket(s).bucket).toBe('D+')
  })

  it('bucket D quando MRR=0 mas docPositionInTop100 ∈ [11, 20]', () => {
    const s = baseSignals({ reciprocalRank: 0, docPositionInTop100: 15 })
    expect(classifyBucket(s).bucket).toBe('D')
  })

  it('bucket D+ quando MRR=0 e docPositionInTop100 ∈ [6, 10]', () => {
    const s = baseSignals({ reciprocalRank: 0, docPositionInTop100: 8 })
    expect(classifyBucket(s).bucket).toBe('D+')
  })
})

describe("classifyBucket — Regra 3 (A) e 4 (A')", () => {
  it('bucket A quando key terms existem mas ausentes do doc esperado', () => {
    const s = baseSignals({
      keyTerms: ['IN SEGES/ME 65/2021'],
      keyTermsInExpectedDoc: { 'IN SEGES/ME 65/2021': false },
      docPositionInTop100: null, // fora do top-100
    })
    expect(classifyBucket(s).bucket).toBe('A')
  })

  it("bucket A' quando termo presente no doc mas doc fora do top-100", () => {
    const s = baseSignals({
      keyTerms: ['14.133/2021'],
      keyTermsInExpectedDoc: { '14.133/2021': true },
      docPositionInTop100: null, // fora do top-100
    })
    expect(classifyBucket(s).bucket).toBe("A'")
  })
})

describe('classifyBucket — Regra 5 (B fallback)', () => {
  it('bucket B quando nada bate', () => {
    const s = baseSignals({
      keyTerms: [], // sem key terms → não cai em A/A'
      docPositionInTop100: null,
    })
    expect(classifyBucket(s).bucket).toBe('B')
  })
})

describe('classifyBucket — edge case: relevantDocs vazio', () => {
  it('retorna B com reason específica quando relevantDocs é []', () => {
    const s = baseSignals({ relevantIds: [], relevantDocs: [] })
    const { bucket, reason } = classifyBucket(s)
    expect(bucket).toBe('B')
    expect(reason).toMatch(/sem docs relevantes/i)
  })
})

describe('classifyBucket — reason ajustada para pos ∈ [1, 5]', () => {
  it('reason menciona ranking parcial quando pos ≤ 5 e recall@5 baixo (múltiplos relevantes)', () => {
    const s = baseSignals({
      reciprocalRank: 1, // pos = 1
      relevantIds: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'],
      relevantDocs: [
        { id: 'd1', exists: true, title: 'T1', contentLen: 500, chunkCount: 5 },
        { id: 'd2', exists: true, title: 'T2', contentLen: 500, chunkCount: 5 },
      ],
      recallAt5: 0.1,
    })
    const { bucket, reason } = classifyBucket(s)
    // Ainda bucket D+ (pos ≤ 10), mas reason NÃO deve dizer "próximo do top-5"
    // pois pos=1 ESTÁ dentro do top-5.
    expect(bucket).toBe('D+')
    expect(reason).not.toMatch(/próximo do top-5/i)
    expect(reason).toMatch(/ranking parcial|incompleto|parte/i)
  })
})
