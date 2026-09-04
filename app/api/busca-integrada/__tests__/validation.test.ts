// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  hybridSearch: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...args: unknown[]) => mocks.enforceRateLimit(...args),
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/auth', () => ({
  verifyAuth: vi.fn().mockResolvedValue({ valid: false }),
  hasAnyActiveAccess: vi.fn(),
}));
vi.mock('@/lib/search/full-text-search', () => ({
  searchDocuments: vi.fn().mockResolvedValue([]),
  searchGlossary: vi.fn().mockResolvedValue([]),
  searchLegislativeActs: vi.fn().mockResolvedValue([]),
  searchBlogPosts: vi.fn().mockResolvedValue([]),
  searchFAQs: vi.fn().mockResolvedValue([]),
  searchTribunalDecisions: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/embeddings/hybrid-search', () => ({
  hybridSearch: (...args: unknown[]) => mocks.hybridSearch(...args),
}));
vi.mock('@/lib/search/hybrid-documents', () => ({ dedupeByDocument: () => [] }));
vi.mock('@/lib/search/mesclar-semantica', () => ({
  mesclarSemDuplicar: (items: unknown[]) => items,
  contarNovos: () => 0,
}));
vi.mock('@/lib/prisma', () => ({ prisma: { document: { findMany: vi.fn() } } }));
vi.mock('@/data/lei-14133-artigos', () => ({ searchLeiArticlesWithExcerpts: () => [] }));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '../route';

describe('/api/busca-integrada validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.hybridSearch.mockResolvedValue({ results: [] });
  });

  it('rejeita q acima de 300 caracteres antes da busca híbrida', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/busca-integrada?q=${'a'.repeat(301)}`),
    );

    expect(response.status).toBe(400);
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.hybridSearch).not.toHaveBeenCalled();
  });

  it('aplica rate limit antes da busca híbrida para consulta válida', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/busca-integrada?q=dispensa'),
    );

    expect(response.status).toBe(200);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith('busca-integrada:127.0.0.1', 30, 60);
    expect(mocks.enforceRateLimit.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.hybridSearch.mock.invocationCallOrder[0]);
  });
});
