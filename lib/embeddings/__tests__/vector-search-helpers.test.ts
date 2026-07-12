// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  resolveEmbeddingColumn,
  buildContextForLLM,
  formatSources,
  type SearchResult,
} from '../vector-search';

const mkResult = (over: Partial<SearchResult> = {}): SearchResult => ({
  documentId: 'd1',
  documentTitle: 'Documento A',
  category: 'pareceres',
  chunkContent: 'conteúdo do chunk',
  chunkIndex: 0,
  similarity: 0.9,
  isCommon: true,
  sourceType: 'document',
  ...over,
});

describe('resolveEmbeddingColumn', () => {
  it('devolve embedding1536 apenas para o valor exato', () => {
    expect(resolveEmbeddingColumn('embedding1536')).toBe('embedding1536');
  });

  it('cai para embedding no default (undefined ou desconhecido)', () => {
    expect(resolveEmbeddingColumn(undefined)).toBe('embedding');
    expect(resolveEmbeddingColumn('qualquer')).toBe('embedding');
  });
});

describe('buildContextForLLM', () => {
  it('monta o contexto com título, relevância percentual e o chunk', () => {
    const ctx = buildContextForLLM([mkResult({ documentTitle: 'Parecer X', similarity: 0.85, chunkContent: 'texto relevante' })]);
    expect(ctx).toContain('[Parecer X]');
    expect(ctx).toContain('85% relevância');
    expect(ctx).toContain('texto relevante');
  });

  it('inclui o ano quando há uploadedAt', () => {
    const ctx = buildContextForLLM([mkResult({ uploadedAt: '2024-06-01' })]);
    expect(ctx).toContain('Ano: 2024');
  });

  it('respeita maxLength e para de acumular', () => {
    const results = [mkResult({ chunkContent: 'a'.repeat(200) }), mkResult({ chunkContent: 'b'.repeat(200) })];
    const ctx = buildContextForLLM(results, 100);
    expect(ctx.length).toBeLessThanOrEqual(100);
  });
});

describe('formatSources', () => {
  it('mapeia os resultados para o formato de citação', () => {
    const sources = formatSources([mkResult({ documentTitle: 'Doc A', similarity: 0.9, url: 'http://x', category: 'decor' })]);
    expect(sources).toEqual([{ title: 'Doc A', relevance: 90, url: 'http://x', category: 'decor' }]);
  });
});
