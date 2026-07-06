// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyAuth,
  mockCheckRateLimit,
  mockHybridSearch,
  mockGenerateStream,
  mockQueryGeminiText,
  mockApiLoggerError,
} = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockHybridSearch: vi.fn(),
  mockGenerateStream: vi.fn(),
  mockQueryGeminiText: vi.fn(),
  mockApiLoggerError: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

vi.mock('@/lib/cache/redis-client', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  withCache: async (_key: string, fn: () => Promise<unknown>) => fn(),
  CACHE_TTL: { GEMINI_QUERY: 86400, SEARCH_RESULTS: 3600 },
}));

vi.mock('@/lib/embeddings/hybrid-search', () => ({
  hybridSearch: (...args: unknown[]) => mockHybridSearch(...args),
}));

vi.mock('@/lib/embeddings/vector-search', () => ({
  buildContextForLLM: () => '',
}));

vi.mock('@/lib/embeddings/citation-validator', () => ({
  validateQuotedCitations: () => ({ invalidQuotes: [], totalQuotes: 0 }),
  buildCitationWarning: () => '',
}));

vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: unknown[]) => mockQueryGeminiText(...args),
}));

vi.mock('@/lib/gemini/config', () => ({
  PRIMARY_GEMINI_MODEL: 'gemini-test',
  FALLBACK_GEMINI_MODELS: [],
}));

vi.mock('@/lib/ai', () => ({
  generateStream: (...args: unknown[]) => mockGenerateStream(...args),
  LEGAL_SAFETY_SETTINGS: [],
}));

vi.mock('@/lib/lei-articles', () => ({
  parseLeiArticles: () => [],
  getLeiArticles: () => [],
}));

vi.mock('@/lib/monitoring/events', () => ({
  trackServerEvent: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockApiLoggerError,
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/legal-context', () => ({
  extractCitedArticles: () => [],
  selectRelevantArticles: async () => [],
  buildLeiContext: () => '',
  buildLeiDocuments: () => [],
  findRelatedActs: async () => [],
  buildLayeredContext: () => '',
  formatActsContext: () => '',
  buildLegalSources: () => [],
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: async () => [] },
    legislativeAct: { findMany: async () => [] },
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/documents/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/documents/query — quota exhausted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({
      valid: true,
      user: { userId: 'u1', role: 'student' },
    });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, limit: 10, remaining: 9, reset: 0 });
    mockQueryGeminiText.mockResolvedValue({ response: '[]' }); // query expansion ignora erros
  });

  it('non-stream: retorna 503 com code=QUOTA_EXHAUSTED quando hybridSearch lança 429', async () => {
    mockHybridSearch.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED quota'));

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: false }));
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('QUOTA_EXHAUSTED');
    expect(body.error).toMatch(/temporariamente indisponível/i);
    expect(body.results).toEqual([]);
  });

  it('non-stream: mantém 500 quando erro não é quota', async () => {
    mockHybridSearch.mockRejectedValue(new Error('boom unexpected'));

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: false }));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBeUndefined();
    expect(body.error).toBe('boom unexpected');
  });

  it('stream: emite evento error com code=QUOTA_EXHAUSTED quando generateStream lança 429', async () => {
    // hybridSearch sucesso para que o pipeline chegue até o stream
    mockHybridSearch.mockResolvedValue({
      results: [
        {
          documentId: 'd1',
          documentTitle: 'Doc',
          category: 'apostila',
          chunkContent: 'conteúdo',
          chunkIndex: 0,
          similarity: 0.7,
          isCommon: true,
          sourceType: 'document',
          leiArticles: null,
        },
      ],
      totalFound: 1,
      cached: false,
    });
    mockGenerateStream.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const text = await res.text();
    expect(text).toContain('"type":"error"');
    expect(text).toContain('"code":"QUOTA_EXHAUSTED"');
    expect(text).toContain('data: [DONE]');
  });

  it('non-stream: retorna 503 também quando queryGeminiText (síntese) lança 429', async () => {
    // hybridSearch sucesso para que o pipeline chegue até o step 14 (synthesis)
    mockHybridSearch.mockResolvedValue({
      results: [
        {
          documentId: 'd1',
          documentTitle: 'Doc',
          category: 'apostila',
          chunkContent: 'conteúdo',
          chunkIndex: 0,
          similarity: 0.7,
          isCommon: true,
          sourceType: 'document',
          leiArticles: null,
        },
      ],
      totalFound: 1,
      cached: false,
    });
    // Primeira chamada (query expansion no step 5) retorna OK pra deixar
    // o pipeline seguir; segunda chamada (synthesis no step 14) lança 429.
    mockQueryGeminiText
      .mockResolvedValueOnce({ response: '[]' })
      .mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED quota'));

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: false }));
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.code).toBe('QUOTA_EXHAUSTED');
    expect(body.error).toMatch(/temporariamente indisponível/i);
  });
});
