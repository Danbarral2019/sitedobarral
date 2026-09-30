// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pós-filtro de acesso do assistente: a busca é simulada e o pipeline roda de
// verdade até as fontes formatadas.
const mocks = vi.hoisted(() => ({
  hybridSearch: vi.fn(),
  documentFindMany: vi.fn(),
}));

vi.mock('@/lib/embeddings/hybrid-search', () => ({
  hybridSearch: (...a: unknown[]) => mocks.hybridSearch(...a),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: (...a: unknown[]) => mocks.documentFindMany(...a) },
    teseTrechoFonte: { findMany: vi.fn().mockResolvedValue([]) },
    legislativeAct: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('@/lib/cache/redis-client', () => ({
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
import type { AcessoDoUsuario } from '@/lib/search/acesso-documentos';

const doc = (id: string, over: Record<string, unknown>) => ({
  documentId: id,
  documentTitle: `Doc ${id}`,
  category: 'parecer',
  chunkContent: `conteúdo sigiloso de ${id}`,
  chunkIndex: 0,
  similarity: 0.8,
  isCommon: false,
  isPublic: false,
  sourceType: 'document' as const,
  ...over,
});

const resultados = [
  doc('pub', { isPublic: true }),
  doc('comum', { isCommon: true }),
  doc('grafo', { category: 'acordao-grafo' }),
  doc('curso3', { courseId: '3' }),
  doc('semcurso', {}),
];

const entrada = { query: 'dispensa de licitação', filters: {}, maxResults: 10, useCache: false };

function idsNoPrompt(ctx: Awaited<ReturnType<typeof assembleAnswerContext>>): string[] {
  return resultados.map((r) => r.documentId).filter((id) => ctx.synthesisPrompt.includes(`conteúdo sigiloso de ${id}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.documentFindMany.mockResolvedValue([]);
  mocks.hybridSearch.mockResolvedValue({ results: resultados, totalFound: resultados.length, cached: false, topVectorSimilarity: 0.8 });
});

describe('assembleAnswerContext: acesso', () => {
  it('repassa o acesso ao hybridSearch', async () => {
    const acesso: AcessoDoUsuario = { isAdmin: false, temAcessoAtivo: false, cursosAtivos: [] };
    await assembleAnswerContext({ ...entrada, acesso });
    expect(mocks.hybridSearch.mock.calls[0][0]).toMatchObject({ acesso });
  });

  it('sem acesso ativo: só o público entra no contexto', async () => {
    const ctx = await assembleAnswerContext({ ...entrada, acesso: { isAdmin: false, temAcessoAtivo: false, cursosAtivos: [] } });
    expect(idsNoPrompt(ctx)).toEqual(['pub']);
  });

  it('com matrícula válida no curso 2: comum e sem curso entram; grafo e curso 3 não', async () => {
    const ctx = await assembleAnswerContext({ ...entrada, acesso: { isAdmin: false, temAcessoAtivo: true, cursosAtivos: ['2'] } });
    expect(idsNoPrompt(ctx).sort()).toEqual(['comum', 'pub', 'semcurso']);
  });

  it('admin vê tudo', async () => {
    const ctx = await assembleAnswerContext({ ...entrada, acesso: { isAdmin: true, temAcessoAtivo: true, cursosAtivos: [] } });
    expect(idsNoPrompt(ctx).sort()).toEqual(['comum', 'curso3', 'grafo', 'pub', 'semcurso']);
  });
});
