// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  hasAnyActiveAccess: vi.fn(),
  hybridSearch: vi.fn(),
  listarPorIds: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/auth', () => ({
  verifyAuth: (...args: unknown[]) => mocks.verifyAuth(...args),
  hasAnyActiveAccess: (...args: unknown[]) => mocks.hasAnyActiveAccess(...args),
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
vi.mock('@/lib/teses/consultas', () => ({
  listarPorIds: (...args: unknown[]) => mocks.listarPorIds(...args),
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

const requisicao = () => new NextRequest('http://localhost/api/busca-integrada?q=qualificação técnica');

/** Opções da chamada ao híbrido que pediu as teses. */
function chamadaDasTeses(): Record<string, unknown> {
  const chamada = mocks.hybridSearch.mock.calls.find(
    (c) => (c[0] as Record<string, unknown>).includeTeses === true,
  );
  if (!chamada) throw new Error('nenhuma chamada pediu as teses');
  return chamada[0] as Record<string, unknown>;
}

describe('/api/busca-integrada: teses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAuth.mockResolvedValue({ valid: false });
    mocks.hybridSearch.mockResolvedValue({ results: [] });
    mocks.listarPorIds.mockResolvedValue([]);
  });

  // A visibilidade depende do leitor, não da rota (spec §9).
  it('visitante recebe só a vitrine', async () => {
    await GET(requisicao());
    expect(chamadaDasTeses().tesesVisibilidade).toBe('vitrine');
  });

  it('autenticado sem acesso ativo recebe só a vitrine', async () => {
    mocks.verifyAuth.mockResolvedValue({ valid: true, user: { userId: 'u1', role: 'student' } });
    mocks.hasAnyActiveAccess.mockResolvedValue(false);
    await GET(requisicao());
    expect(chamadaDasTeses().tesesVisibilidade).toBe('vitrine');
  });

  it('quem tem acesso ativo recebe o acervo', async () => {
    mocks.verifyAuth.mockResolvedValue({ valid: true, user: { userId: 'u1', role: 'student' } });
    mocks.hasAnyActiveAccess.mockResolvedValue(true);
    await GET(requisicao());
    expect(chamadaDasTeses().tesesVisibilidade).toBe('acervo');
  });

  it('a busca de documentos continua sem o ramo das teses', async () => {
    await GET(requisicao());
    const semTeses = mocks.hybridSearch.mock.calls.filter(
      (c) => !(c[0] as Record<string, unknown>).includeTeses,
    );
    expect(semTeses).toHaveLength(1);
  });

  it('relê as teses encontradas pela porta única, com o acesso do leitor', async () => {
    mocks.hybridSearch.mockImplementation(async (o: Record<string, unknown>) => ({
      results: o.includeTeses
        ? [
            { documentId: 'e2', sourceType: 'tese' },
            { documentId: 'e1', sourceType: 'tese' },
          ]
        : [],
    }));
    mocks.listarPorIds.mockResolvedValue([{ enunciadoId: 'e2' }, { enunciadoId: 'e1' }]);

    const resposta = await GET(requisicao());
    const corpo = await resposta.json();

    expect(mocks.listarPorIds).toHaveBeenCalledWith(['e2', 'e1'], false);
    expect(corpo.results.teses.map((t: { enunciadoId: string }) => t.enunciadoId)).toEqual(['e2', 'e1']);
  });

  it('uma falha na busca das teses não derruba a busca integrada', async () => {
    mocks.hybridSearch.mockImplementation(async (o: Record<string, unknown>) => {
      if (o.includeTeses) throw new Error('quota do Gemini');
      return { results: [] };
    });

    const resposta = await GET(requisicao());
    expect(resposta.status).toBe(200);
    expect((await resposta.json()).results.teses).toEqual([]);
  });
});
