// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  hybridSearch: vi.fn(),
  searchDocuments: vi.fn(),
  docFindMany: vi.fn(),
  enrollmentFindMany: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/auth', () => ({
  verifyAuth: (...args: unknown[]) => mocks.verifyAuth(...args),
}));
vi.mock('@/lib/search/full-text-search', () => ({
  searchDocuments: (...args: unknown[]) => mocks.searchDocuments(...args),
  searchGlossary: vi.fn().mockResolvedValue([]),
  searchLegislativeActs: vi.fn().mockResolvedValue([]),
  searchBlogPosts: vi.fn().mockResolvedValue([]),
  searchFAQs: vi.fn().mockResolvedValue([]),
  searchTribunalDecisions: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/embeddings/hybrid-search', () => ({
  hybridSearch: (...args: unknown[]) => mocks.hybridSearch(...args),
}));
vi.mock('@/lib/teses/consultas', () => ({ listarPorIds: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: (...a: unknown[]) => mocks.docFindMany(...a) },
    enrollment: { findMany: (...a: unknown[]) => mocks.enrollmentFindMany(...a) },
    subscription: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('@/data/lei-14133-artigos', () => ({ searchLeiArticlesWithExcerpts: () => [] }));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '../route';

const requisicao = () => new NextRequest('http://localhost/api/busca-integrada?q=dispensa de licitação');

const linhaFts = (over: Record<string, unknown>) => ({
  data: {
    id: 'x', title: 'T', description: 'desc', category: 'parecer', type: 'pdf', url: 'https://r2/x.pdf',
    course_id: null, tags: null, uploaded_at: new Date(), is_public: false, is_common: false, rank: 1,
    ...over,
  },
  rank: 1,
});

const linhaDoc = (over: Record<string, unknown>) => ({
  id: 'x', title: 'T', description: 'desc', category: 'parecer', type: 'pdf', url: 'https://r2/x.pdf',
  courseId: null, uploadedAt: new Date(), isPublic: false, isCommon: false, ...over,
});

describe('/api/busca-integrada: acesso aos documentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAuth.mockResolvedValue({ valid: false });
    mocks.searchDocuments.mockResolvedValue([]);
    mocks.hybridSearch.mockResolvedValue({ results: [] });
    mocks.docFindMany.mockResolvedValue([]);
    mocks.enrollmentFindMany.mockResolvedValue([]);
  });

  it('anônimo: documento comum aparece sem url nem descrição', async () => {
    mocks.searchDocuments.mockResolvedValue([
      linhaFts({ id: 'pub', is_public: true, url: 'https://pub' }),
      linhaFts({ id: 'comum', is_common: true, url: 'https://r2/comum.pdf', description: 'segredo' }),
    ]);
    const corpo = await (await GET(requisicao())).json();
    const docs = corpo.results.documents;
    expect(docs.map((d: { id: string }) => d.id)).toEqual(['pub', 'comum']);
    expect(docs[0]).toMatchObject({ url: 'https://pub', hasAccess: true });
    expect(docs[1]).toMatchObject({ url: null, description: null, hasAccess: false, requiresEnrollment: true });
  });

  it('semântica: grafo e material de curso não aparecem para quem não pode ver', async () => {
    mocks.hybridSearch.mockImplementation(async (o: Record<string, unknown>) => ({
      results: o.includeTeses
        ? []
        : [
            { documentId: 'grafo', sourceType: 'document', similarity: 0.9 },
            { documentId: 'curso', sourceType: 'document', similarity: 0.8 },
            { documentId: 'pub', sourceType: 'document', similarity: 0.7 },
          ],
    }));
    mocks.docFindMany.mockResolvedValue([
      linhaDoc({ id: 'grafo', category: 'acordao-grafo', url: 'https://tcu/grafo' }),
      linhaDoc({ id: 'curso', courseId: '3' }),
      linhaDoc({ id: 'pub', isPublic: true }),
    ]);
    const corpo = await (await GET(requisicao())).json();
    expect(corpo.results.documents.map((d: { id: string }) => d.id)).toEqual(['pub']);
  });

  it('matriculado no curso vê o material do curso com url', async () => {
    mocks.verifyAuth.mockResolvedValue({ valid: true, user: { userId: 'u1', role: 'student' } });
    mocks.enrollmentFindMany.mockResolvedValue([{ courseId: '3' }]);
    mocks.hybridSearch.mockImplementation(async (o: Record<string, unknown>) => ({
      results: o.includeTeses ? [] : [{ documentId: 'curso', sourceType: 'document', similarity: 0.8 }],
    }));
    mocks.docFindMany.mockResolvedValue([linhaDoc({ id: 'curso', courseId: '3' })]);
    const corpo = await (await GET(requisicao())).json();
    expect(corpo.results.documents[0]).toMatchObject({ id: 'curso', url: 'https://r2/x.pdf', hasAccess: true });
  });
});
