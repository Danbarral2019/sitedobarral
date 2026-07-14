// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSemanticSearch,
  mockMultiQuerySearch,
  mockSearchDocuments,
} = vi.hoisted(() => ({
  mockSemanticSearch: vi.fn(),
  mockMultiQuerySearch: vi.fn(),
  mockSearchDocuments: vi.fn(),
}));

vi.mock('../vector-search', () => ({
  semanticSearch: (query: string, options: unknown) => mockSemanticSearch(query, options),
  multiQuerySearch: (queries: string[], options: unknown) => mockMultiQuerySearch(queries, options),
}));

vi.mock('../../search/full-text-search', () => ({
  searchDocuments: (query: string, options: unknown) => mockSearchDocuments(query, options),
}));

vi.mock('../reranker', () => ({
  rerankResults: (_q: string, results: unknown) => Promise.resolve(results),
}));

import { hybridSearch } from '../hybrid-search';

beforeEach(() => {
  mockSemanticSearch.mockReset();
  mockMultiQuerySearch.mockReset();
  mockSearchDocuments.mockReset();
  mockSemanticSearch.mockResolvedValue({
    results: [],
    query: '',
    totalFound: 0,
    latency: 0,
    cached: false,
  });
  mockSearchDocuments.mockResolvedValue([]);
});

describe('hybridSearch — skipFts', () => {
  it('default (skipFts não setado): chama searchDocuments E semanticSearch', async () => {
    await hybridSearch({ query: 'qualquer coisa', useCache: false });
    expect(mockSemanticSearch).toHaveBeenCalledTimes(1);
    expect(mockSearchDocuments).toHaveBeenCalledTimes(1);
  });

  it('skipFts=true: NÃO chama searchDocuments; só vetor', async () => {
    await hybridSearch({ query: 'qualquer coisa', useCache: false, skipFts: true });
    expect(mockSemanticSearch).toHaveBeenCalledTimes(1);
    expect(mockSearchDocuments).not.toHaveBeenCalled();
  });
});

describe('hybridSearch — passthrough de filtros vector', () => {
  it('passa skipDocumentBranch / skipLegislativeActBranch / tribunalCodeFilter pro semanticSearch', async () => {
    await hybridSearch({
      query: 'q',
      useCache: false,
      skipDocumentBranch: true,
      skipLegislativeActBranch: true,
      includeTribunalDecisions: true,
      tribunalCodeFilter: 'TST',
    });

    const calledOptions = mockSemanticSearch.mock.calls[0][1] as Record<string, unknown>;
    expect(calledOptions.skipDocumentBranch).toBe(true);
    expect(calledOptions.skipLegislativeActBranch).toBe(true);
    expect(calledOptions.tribunalCodeFilter).toBe('TST');
    expect(calledOptions.includeTribunalDecisions).toBe(true);
  });

  it('encaminha tribunalBoost pro semanticSearch', async () => {
    await hybridSearch({
      query: 'q',
      useCache: false,
      includeTribunalDecisions: true,
      tribunalBoost: { code: 'TST', factor: 1.2 },
    });

    const calledOptions = mockSemanticSearch.mock.calls[0][1] as Record<string, unknown>;
    expect(calledOptions.tribunalBoost).toEqual({ code: 'TST', factor: 1.2 });
  });
});

describe('hybridSearch — merge RRF de vetor + FTS', () => {
  it('combina resultados de vetor e FTS, inclui doc só-FTS e parseia tags', async () => {
    mockSemanticSearch.mockResolvedValue({
      results: [{
        documentId: 'd1', documentTitle: 'Vetor 1', category: 'acordao', chunkContent: 'trecho vetor',
        chunkIndex: 0, similarity: 0.9, isCommon: true, sourceType: 'document',
      }],
      query: 'q', totalFound: 1, latency: 0, cached: false,
    });
    mockSearchDocuments.mockResolvedValue([
      { data: { id: 'd2', title: 'FTS Doc', category: 'parecer', description: 'resumo fts', url: 'http://u', course_id: null, tags: '["a","b"]' } },
    ]);

    const res = await hybridSearch({ query: 'dispensa de licitação', useCache: false });
    const ids = res.results.map((r) => r.documentId);
    expect(ids).toContain('d1'); // veio do vetor
    expect(ids).toContain('d2'); // só-FTS, montado do lado FTS
    const d2 = res.results.find((r) => r.documentId === 'd2')!;
    expect(d2.tags).toEqual(['a', 'b']); // safeParseArray
    expect(d2.chunkContent).toBe('resumo fts');
  });

  it('degrada para semantic-only quando o FTS lança erro', async () => {
    mockSemanticSearch.mockResolvedValue({
      results: [{ documentId: 'd1', documentTitle: 'V', category: 'acordao', chunkContent: 'c', chunkIndex: 0, similarity: 0.8, isCommon: true, sourceType: 'document' }],
      query: 'q', totalFound: 1, latency: 0, cached: false,
    });
    mockSearchDocuments.mockRejectedValue(new Error('GIN index down'));
    const res = await hybridSearch({ query: 'pregão eletrônico', useCache: false });
    expect(res.results.map((r) => r.documentId)).toContain('d1');
  });
});
