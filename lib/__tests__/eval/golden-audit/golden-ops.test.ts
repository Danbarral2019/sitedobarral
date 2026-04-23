// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addToAnnotations, removeFromAnnotations } from '@/eval/scripts/golden-audit/golden-ops'
import type { GoldenAnnotations } from '@/eval/types'

function baseAnn(overrides: Partial<GoldenAnnotations> = {}): GoldenAnnotations {
  return {
    relevant: ['a', 'b'],
    highlyRelevant: ['a'],
    annotatedAt: '2026-01-01T00:00:00Z',
    annotatedBy: 'test',
    notes: '',
    ...overrides,
  }
}

describe('addToAnnotations', () => {
  it('adiciona id em relevant quando list=relevant', () => {
    const ann = baseAnn()
    const out = addToAnnotations(ann, 'c', 'relevant')
    expect(out.relevant).toEqual(['a', 'b', 'c'])
    expect(out.highlyRelevant).toEqual(['a'])
  })

  it('adiciona em ambos quando list=highly', () => {
    const ann = baseAnn()
    const out = addToAnnotations(ann, 'c', 'highly')
    expect(out.relevant).toEqual(['a', 'b', 'c'])
    expect(out.highlyRelevant).toEqual(['a', 'c'])
  })

  it('não duplica id já presente em relevant', () => {
    const ann = baseAnn()
    const out = addToAnnotations(ann, 'b', 'relevant')
    expect(out.relevant).toEqual(['a', 'b'])
  })

  it('promove de relevant-only pra highly quando list=highly', () => {
    const ann = baseAnn() // 'b' está em relevant mas não highly
    const out = addToAnnotations(ann, 'b', 'highly')
    expect(out.relevant).toEqual(['a', 'b'])
    expect(out.highlyRelevant).toEqual(['a', 'b'])
  })

  it('não muta input', () => {
    const ann = baseAnn()
    const originalRelevant = [...ann.relevant]
    addToAnnotations(ann, 'c', 'relevant')
    expect(ann.relevant).toEqual(originalRelevant)
  })
})

describe('removeFromAnnotations', () => {
  it('remove id de relevant e highlyRelevant', () => {
    const ann = baseAnn()
    const out = removeFromAnnotations(ann, 'a')
    expect(out.relevant).toEqual(['b'])
    expect(out.highlyRelevant).toEqual([])
  })

  it('no-op para id inexistente', () => {
    const ann = baseAnn()
    const out = removeFromAnnotations(ann, 'zzz')
    expect(out.relevant).toEqual(['a', 'b'])
    expect(out.highlyRelevant).toEqual(['a'])
  })

  it('não muta input', () => {
    const ann = baseAnn()
    const originalRelevant = [...ann.relevant]
    removeFromAnnotations(ann, 'a')
    expect(ann.relevant).toEqual(originalRelevant)
  })
})
