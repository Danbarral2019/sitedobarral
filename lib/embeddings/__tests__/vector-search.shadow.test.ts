import { describe, it, expect } from 'vitest'
import { resolveEmbeddingColumn } from '../vector-search'

describe('resolveEmbeddingColumn — whitelist', () => {
  it('default é embedding', () => {
    expect(resolveEmbeddingColumn(undefined)).toBe('embedding')
  })
  it('aceita embedding1536', () => {
    expect(resolveEmbeddingColumn('embedding1536')).toBe('embedding1536')
  })
  it('rejeita qualquer outro valor (anti-injeção) caindo no default', () => {
    expect(resolveEmbeddingColumn('embedding; DROP TABLE x')).toBe('embedding')
    expect(resolveEmbeddingColumn('foo')).toBe('embedding')
  })
})
