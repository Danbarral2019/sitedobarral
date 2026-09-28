// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Testa a costura da §9 dentro de assembleAnswerContext: a busca é simulada,
// e o resto do pipeline roda de verdade até montar o prompt.
const mocks = vi.hoisted(() => ({
  hybridSearch: vi.fn(),
  documentFindMany: vi.fn(),
  trechoFindMany: vi.fn(),
}));

vi.mock('@/lib/embeddings/hybrid-search', () => ({
  hybridSearch: (...a: unknown[]) => mocks.hybridSearch(...a),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: (...a: unknown[]) => mocks.documentFindMany(...a) },
    teseTrechoFonte: { findMany: (...a: unknown[]) => mocks.trechoFindMany(...a) },
    legislativeAct: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('@/lib/cache/redis-client', () => ({
  // A expansão de query é descartada: sem ela, só a busca simulada importa.
  withCache: async () => [],
  CACHE_TTL: { GEMINI_QUERY: 60 },
}));
vi.mock('@/lib/gemini/cached-client', () => ({ queryGeminiText: vi.fn() }));
vi.mock('@/lib/legal-context', () => ({
  extractCitedArticles: () => [],
  selectRelevantArticles: async () => [],
  buildLeiContext: () => '',
  buildLeiDocuments: () => [],
  findRelatedActs: async () => [],
  buildLayeredContext: (lei: string, atos: string, docs: string) => [lei, atos, docs].join('\n'),
  formatActsContext: () => '',
  buildLegalSources: () => [],
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { assembleAnswerContext } from '../answerContext';

const tese = {
  documentId: 'e1',
  documentTitle: 'Acórdão 1441/2016',
  category: 'tese',
  chunkContent: 'Qualificação técnica\nAcórdão 1441/2016\n\nA exigência deve guardar pertinência com o objeto.',
  chunkIndex: 0,
  similarity: 0.9,
  isCommon: true,
  sourceType: 'tese' as const,
};

const entrada = { query: 'atestado de capacidade técnica', filters: {}, maxResults: 5, useCache: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.documentFindMany.mockResolvedValue([]);
  mocks.trechoFindMany.mockResolvedValue([]);
});

describe('assembleAnswerContext — teses', () => {
  it('a tese entra no prompt com o trecho do citante, e o citante entra junto', async () => {
    mocks.hybridSearch.mockResolvedValue({ results: [tese], totalFound: 1, cached: false, topVectorSimilarity: 0.9 });
    mocks.trechoFindMany.mockResolvedValue([{
      enunciadoId: 'e1', ordem: 0, trecho: 'O relator consignou a pertinência.',
      origemNumero: 100, origemAno: 2020, noVoto: true,
      origemDocumentId: 'd100', origemUrl: null, origemLinkPDF: null,
    }]);
    mocks.documentFindMany.mockImplementation(async (args: { where: { id?: { in: string[] } } }) =>
      args.where.id?.in?.includes('d100')
        ? [{
            id: 'd100', title: 'Acórdão 100/2020 - Plenário', category: 'acordao',
            description: 'Ementa do acórdão citante.', url: 'https://tcu/100',
            courseId: null, isCommon: true, tags: null, leiArticlesArr: [],
          }]
        : [],
    );

    const ctx = await assembleAnswerContext(entrada);

    expect(ctx.synthesisPrompt).toContain('A exigência deve guardar pertinência');
    expect(ctx.synthesisPrompt).toContain('O relator consignou a pertinência.');
    expect(ctx.synthesisPrompt).toContain('Acórdão 100/2020 - Plenário');
  });

  it('a tese sem trecho-fonte não entra no prompt', async () => {
    mocks.hybridSearch.mockResolvedValue({ results: [tese], totalFound: 1, cached: false, topVectorSimilarity: 0.9 });

    const ctx = await assembleAnswerContext(entrada);

    expect(ctx.synthesisPrompt).not.toContain('A exigência deve guardar pertinência');
  });

  it('sem tese na busca, a evidência não é consultada', async () => {
    mocks.hybridSearch.mockResolvedValue({
      results: [{ ...tese, documentId: 'd1', category: 'acordao', sourceType: 'document' }],
      totalFound: 1, cached: false, topVectorSimilarity: 0.9,
    });

    await assembleAnswerContext(entrada);

    expect(mocks.trechoFindMany).not.toHaveBeenCalled();
  });
});
