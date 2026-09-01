// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCount, mockFindMany, mockGlossaryCacheKey } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockFindMany: vi.fn(),
  mockGlossaryCacheKey: vi.fn((_params: unknown) => 'glossary:test'),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    glossaryTerm: {
      count: (...args: unknown[]) => mockCount(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('@/lib/cache/redis-client', () => ({
  CacheKeys: {
    glossaryTerms: (params: unknown) => mockGlossaryCacheKey(params),
  },
  CACHE_TTL: { GLOSSARY: 60 },
  withCache: async (_key: string, loader: () => Promise<unknown>) => loader(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/glossary/route';

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/glossary${query ? `?${query}` : ''}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCount.mockResolvedValue(0);
  mockFindMany.mockResolvedValue([]);
});

describe('GET /api/glossary', () => {
  it('usa a primeira página de 30 termos por padrão', async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ take: 30, skip: 0 }),
    );
    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 30,
      total: 0,
      totalPages: 0,
      hasMore: false,
    });
  });

  it('limita pageSize a 30 e calcula o deslocamento pela página', async () => {
    mockCount.mockResolvedValue(95);

    const response = await GET(makeRequest('page=2&pageSize=200'));
    const body = await response.json();

    expect(mockFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ take: 30, skip: 30 }),
    );
    expect(body.pagination).toEqual({
      page: 2,
      pageSize: 30,
      total: 95,
      totalPages: 4,
      hasMore: true,
    });
  });

  it('aplica busca, letra e categoria antes de take e skip', async () => {
    await GET(
      makeRequest('q=preg%C3%A3o&letter=P&category=Modalidade&page=3&pageSize=10'),
    );

    const expectedWhere = {
      isPublic: true,
      category: 'Modalidade',
      term: { startsWith: 'P', mode: 'insensitive' },
      OR: [
        { term: { contains: 'pregão', mode: 'insensitive' } },
        { definition: { contains: 'pregão', mode: 'insensitive' } },
        { shortDef: { contains: 'pregão', mode: 'insensitive' } },
      ],
    };

    expect(mockFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expectedWhere,
        take: 10,
        skip: 20,
      }),
    );
    expect(mockCount).toHaveBeenCalledWith({ where: expectedWhere });
    expect(mockGlossaryCacheKey).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Modalidade',
        letter: 'P',
        query: 'pregão',
        page: 3,
        pageSize: 10,
      }),
    );
  });

  it('retorna categorias e letras disponíveis com o contrato paginado', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: 'term-1',
          term: 'Pregão',
          slug: 'pregao',
          definition: 'Definição',
          shortDef: null,
          category: 'Modalidade',
          viewCount: 3,
          leiArticlesArr: ['17'],
          relatedTerms: null,
        },
      ])
      .mockResolvedValueOnce([
        { term: 'Pregão', category: 'Modalidade' },
        { term: 'Adjudicação', category: 'Fase' },
        { term: 'Ata', category: 'Fase' },
      ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.terms).toHaveLength(1);
    expect(body.categories).toEqual(['Fase', 'Modalidade']);
    expect(body.availableLetters).toEqual(['A', 'P']);
    expect(body.pagination.total).toBe(1);
  });
});
