// @vitest-environment node
/**
 * Testes das funções especializadas de vector-search: findRelatedDocuments,
 * searchByLeiArticle, multiQuerySearch, buildContextForLLM, formatSources,
 * resolveEmbeddingColumn. Complementa vector-search.test.ts (semanticSearch).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe, mockGenEmbedding, mockDocFindUnique } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  mockGenEmbedding: vi.fn(),
  mockDocFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: (...a: any[]) => mockQueryRawUnsafe(...a),
    document: { findUnique: (...a: any[]) => mockDocFindUnique(...a) },
  },
}));
vi.mock('../gemini-embeddings', () => ({
  generateQueryEmbedding: (...a: any[]) => mockGenEmbedding(...a),
  embeddingToSql: (emb: number[]) => `[${emb.join(',')}]`,
}));
vi.mock('@/lib/cache/redis-client', () => ({
  withCache: (_k: string, fn: () => Promise<any>) => fn(),
  CACHE_TTL: { SEARCH_RESULTS: 60 },
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  findRelatedDocuments,
  searchByLeiArticle,
  multiQuerySearch,
  buildContextForLLM,
  formatSources,
  resolveEmbeddingColumn,
} from '../vector-search';
import type { SearchResult } from '../vector-search';

function row(over: Record<string, unknown> = {}) {
  return {
    document_id: 'd1', document_title: 'Doc 1', category: 'acordao', chunk_content: 'trecho',
    chunk_index: 0, similarity: 0.85, url: null, course_id: null, is_common: true,
    tags: null, lei_articles: [], source_type: 'document', uploaded_at: '2024-01-01', ...over,
  };
}

function mkResult(over: Partial<SearchResult> = {}): SearchResult {
  return {
    documentId: 'd1', documentTitle: 'Doc 1', category: 'acordao', chunkContent: 'trecho',
    chunkIndex: 0, similarity: 0.85, isCommon: true, sourceType: 'document',
    uploadedAt: '2024-06-01T00:00:00.000Z', ...over,
  } as SearchResult;
}

beforeEach(() => {
  mockQueryRawUnsafe.mockReset();
  mockGenEmbedding.mockReset();
  mockDocFindUnique.mockReset();
  mockGenEmbedding.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
  mockQueryRawUnsafe.mockResolvedValue([]);
});

describe('resolveEmbeddingColumn', () => {
  it('mapeia dimensões para a coluna correta', () => {
    expect(resolveEmbeddingColumn('embedding1536')).toBe('embedding1536');
    expect(resolveEmbeddingColumn(undefined)).toBe('embedding');
    expect(resolveEmbeddingColumn('qualquer-outra')).toBe('embedding');
  });
});

describe('findRelatedDocuments', () => {
  it('retorna [] quando o documento não tem texto extraído', async () => {
    mockDocFindUnique.mockResolvedValue({ extractedText: null, courseId: null });
    expect(await findRelatedDocuments('doc-x')).toEqual([]);
  });

  it('busca por similaridade e exclui o próprio documento dos resultados', async () => {
    mockDocFindUnique.mockResolvedValue({ extractedText: 'texto base do documento', courseId: 'c1' });
    mockQueryRawUnsafe.mockResolvedValue([row({ document_id: 'doc-self' }), row({ document_id: 'outro' })]);
    const out = await findRelatedDocuments('doc-self', 5);
    expect(out.every((r) => r.documentId !== 'doc-self')).toBe(true);
  });
});

describe('searchByLeiArticle', () => {
  it('enriquece a query com o artigo e delega ao semanticSearch', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const res = await searchByLeiArticle('75', 'dispensa por valor', 5);
    expect(res.query).toContain('Art. 75');
    expect(res.results).toEqual([]);
    expect(mockGenEmbedding).toHaveBeenCalled();
  });
});

describe('multiQuerySearch', () => {
  it('executa cada query em paralelo e devolve lista deduplicada por documento', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      row({ document_id: 'd1', similarity: 0.9 }),
      row({ document_id: 'd2', similarity: 0.6 }),
    ]);
    const out = await multiQuerySearch(['dispensa de licitação', 'pregão eletrônico'], { limit: 5, useCache: false });
    // uma busca por query (ao menos)
    expect(mockQueryRawUnsafe).toHaveBeenCalled();
    // resultado sempre é um array e nunca tem documentId repetido
    expect(Array.isArray(out)).toBe(true);
    const ids = out.map((r) => r.documentId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildContextForLLM', () => {
  it('formata cada fonte com título, relevância e ano', () => {
    const ctx = buildContextForLLM([mkResult({ documentTitle: 'Acórdão X', similarity: 0.9 })]);
    expect(ctx).toContain('Acórdão X');
    expect(ctx).toContain('90% relevância');
    expect(ctx).toContain('Ano: 2024');
  });

  it('respeita o limite de comprimento (corta quando excede)', () => {
    const big = mkResult({ chunkContent: 'x'.repeat(500) });
    const ctx = buildContextForLLM([big, big, big], 300);
    expect(ctx.length).toBeLessThanOrEqual(300);
  });
});

describe('formatSources', () => {
  it('mapeia para o shape de citação com relevância em porcentagem', () => {
    const out = formatSources([mkResult({ documentTitle: 'T', similarity: 0.83, url: 'http://u', category: 'parecer' })]);
    expect(out[0]).toEqual({ title: 'T', relevance: 83, url: 'http://u', category: 'parecer' });
  });
});
