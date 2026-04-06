// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { recallAtK, reciprocalRank, ndcgAtK } from '@/eval/metrics'

describe('recallAtK', () => {
  it('returns 1.0 when all relevant items are in top-k', () => {
    expect(recallAtK(['a', 'b', 'c', 'd', 'e'], new Set(['a', 'c']), 5)).toBe(1.0)
  })

  it('returns 0.5 when half the relevant items are in top-k', () => {
    expect(recallAtK(['a', 'x', 'y', 'z', 'w'], new Set(['a', 'b']), 5)).toBe(0.5)
  })

  it('returns 0 when no relevant items are in top-k', () => {
    expect(recallAtK(['x', 'y', 'z'], new Set(['a', 'b']), 5)).toBe(0)
  })

  it('returns 0 when relevant set is empty (avoid div by zero)', () => {
    expect(recallAtK(['a'], new Set(), 5)).toBe(0)
  })

  it('caps at top-k even if more relevant items appear later', () => {
    // Item 'b' relevant está na posição 6, fora do top-5
    expect(recallAtK(['a', 'x', 'y', 'z', 'w', 'b'], new Set(['a', 'b']), 5)).toBe(0.5)
  })
})

describe('reciprocalRank', () => {
  it('returns 1.0 when first item is relevant', () => {
    expect(reciprocalRank(['a', 'b', 'c'], new Set(['a']))).toBe(1.0)
  })

  it('returns 0.5 when second item is the first relevant', () => {
    expect(reciprocalRank(['x', 'a', 'b'], new Set(['a']))).toBe(0.5)
  })

  it('returns 0 when no relevant item is in the ranking', () => {
    expect(reciprocalRank(['x', 'y', 'z'], new Set(['a']))).toBe(0)
  })

  it('returns rank of first match even if others appear later', () => {
    expect(reciprocalRank(['x', 'a', 'b', 'c'], new Set(['b', 'c']))).toBeCloseTo(1 / 3)
  })
})

describe('ndcgAtK', () => {
  it('returns 1.0 when ranking is perfect (highly relevant first)', () => {
    const predicted = ['hr1', 'hr2', 'r1', 'x', 'y']
    const relevant = new Set(['hr1', 'hr2', 'r1'])
    const highlyRelevant = new Set(['hr1', 'hr2'])
    expect(ndcgAtK(predicted, relevant, highlyRelevant, 10)).toBeCloseTo(1.0)
  })

  it('returns null when there are no relevant items (IDCG = 0)', () => {
    expect(ndcgAtK(['a'], new Set(), new Set(), 10)).toBeNull()
  })

  it('penalizes when relevant items appear later in ranking', () => {
    const perfect = ndcgAtK(['a', 'b', 'x', 'y'], new Set(['a', 'b']), new Set(), 10)!
    const worse = ndcgAtK(['x', 'y', 'a', 'b'], new Set(['a', 'b']), new Set(), 10)!
    expect(perfect).toBeGreaterThan(worse)
    expect(perfect).toBeCloseTo(1.0)
  })

  it('weights highly relevant items more than relevant items', () => {
    const hrFirst = ndcgAtK(['hr', 'r'], new Set(['hr', 'r']), new Set(['hr']), 10)!
    const rFirst = ndcgAtK(['r', 'hr'], new Set(['hr', 'r']), new Set(['hr']), 10)!
    expect(hrFirst).toBeGreaterThan(rFirst)
  })
})
