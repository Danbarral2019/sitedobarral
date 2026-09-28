// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe, mockGenerateQueryEmbedding, mockWithCache } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  mockGenerateQueryEmbedding: vi.fn(),
  mockWithCache: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args) },
}));
vi.mock('../gemini-embeddings', () => ({
  generateQueryEmbedding: (...args: unknown[]) => mockGenerateQueryEmbedding(...args),
  embeddingToSql: (emb: number[]) => `[${emb.join(',')}]`,
}));
vi.mock('@/lib/cache/redis-client', () => ({
  withCache: (key: string, fn: () => Promise<unknown>) => mockWithCache(key, fn),
  CACHE_TTL: { SEARCH_RESULTS: 60 },
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { chaveVisibilidadeTeses, semanticSearch } from '../vector-search';

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateQueryEmbedding.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
  mockQueryRawUnsafe.mockResolvedValue([]);
  mockWithCache.mockImplementation((_key: string, fn: () => Promise<unknown>) => fn());
});

function ultimoSql(): string {
  const chamadas = mockQueryRawUnsafe.mock.calls;
  return chamadas[chamadas.length - 1][0] as string;
}

describe('chaveVisibilidadeTeses', () => {
  // Sem isto há vazamento: a consulta de quem tem acesso ativo gravaria no
  // cache um resultado com o acervo, e o próximo anônimo com a mesma pergunta
  // receberia esse resultado (spec §9).
  it('distingue desligado, vitrine e acervo', () => {
    expect(chaveVisibilidadeTeses({})).toBe('off');
    expect(chaveVisibilidadeTeses({ includeTeses: true })).toBe('vitrine');
    expect(chaveVisibilidadeTeses({ includeTeses: true, tesesVisibilidade: 'vitrine' })).toBe('vitrine');
    expect(chaveVisibilidadeTeses({ includeTeses: true, tesesVisibilidade: 'acervo' })).toBe('acervo');
  });

  it('ignora a visibilidade quando o ramo está desligado', () => {
    expect(chaveVisibilidadeTeses({ tesesVisibilidade: 'acervo' })).toBe('off');
  });
});

describe('semanticSearch — ramo das teses', () => {
  it('fica desligado quando o chamador não pede', async () => {
    await semanticSearch('qualificação técnica', { useCache: false });
    expect(ultimoSql()).not.toMatch(/"TeseEnunciadoChunk"/);
  });

  it('na vitrine, exige a promoção e a identidade oficial do acórdão-líder', async () => {
    await semanticSearch('qualificação técnica', { useCache: false, includeTeses: true });
    const sql = ultimoSql();
    expect(sql).toMatch(/FROM "TeseEnunciadoChunk"/);
    expect(sql).toMatch(/te\.veredito = 'fiel' AND te\."retiradoEm" IS NULL AND td\.atual = true AND te\.publicado = true/);
    expect(sql).toMatch(/te\."vitrinePublica" = true AND td\."acordaoKey" IS NOT NULL/);
  });

  it('no acervo, dispensa a promoção e a identidade oficial, mas não o predicado base', async () => {
    await semanticSearch('qualificação técnica', {
      useCache: false,
      includeTeses: true,
      tesesVisibilidade: 'acervo',
    });
    const sql = ultimoSql();
    expect(sql).toMatch(/te\.veredito = 'fiel' AND te\."retiradoEm" IS NULL AND td\.atual = true AND te\.publicado = true/);
    expect(sql).not.toMatch(/vitrinePublica/);
    expect(sql).not.toMatch(/acordaoKey/);
  });

  // A tabela das teses não tem a coluna do A/B de 1536 dimensões.
  it('não entra na busca pela coluna de 1536 dimensões', async () => {
    await semanticSearch('qualificação técnica', {
      useCache: false,
      includeTeses: true,
      embeddingColumn: 'embedding1536',
    });
    expect(ultimoSql()).not.toMatch(/"TeseEnunciadoChunk"/);
  });

  it('só as teses pedidas, na coluna de 1536: não monta SQL vazio', async () => {
    const r = await semanticSearch('qualificação técnica', {
      useCache: false,
      includeTeses: true,
      skipDocumentBranch: true,
      skipLegislativeActBranch: true,
      embeddingColumn: 'embedding1536',
    });
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
    expect(r.results).toEqual([]);
  });

  it('devolve a tese com sourceType próprio', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      {
        document_id: 'e1',
        document_title: 'Acórdão 1441/2016',
        category: 'tese',
        chunk_content: 'Assunto\nAcórdão 1441/2016\n\nEnunciado',
        chunk_index: 0,
        similarity: 0.8,
        url: null,
        course_id: null,
        is_common: true,
        tags: null,
        lei_articles: null,
        source_type: 'tese',
        uploaded_at: null,
      },
    ]);
    const r = await semanticSearch('qualificação técnica', { useCache: false, includeTeses: true });
    expect(r.results[0]).toMatchObject({ documentId: 'e1', sourceType: 'tese' });
  });

  it('a visibilidade faz parte da chave de cache', async () => {
    await semanticSearch('mesma pergunta', { includeTeses: true, tesesVisibilidade: 'acervo' });
    await semanticSearch('mesma pergunta', { includeTeses: true, tesesVisibilidade: 'vitrine' });
    await semanticSearch('mesma pergunta', {});
    const chaves = mockWithCache.mock.calls.map((c) => c[0] as string);
    expect(chaves[0]).toContain(':ts=acervo:');
    expect(chaves[1]).toContain(':ts=vitrine:');
    expect(chaves[2]).toContain(':ts=off:');
  });
});
