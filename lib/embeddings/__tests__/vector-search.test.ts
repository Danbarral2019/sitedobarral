// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRawUnsafe,
  mockGenerateQueryEmbedding,
} = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  mockGenerateQueryEmbedding: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: (...args: any[]) => mockQueryRawUnsafe(...args),
  },
}));

vi.mock('../gemini-embeddings', () => ({
  generateQueryEmbedding: (...args: any[]) => mockGenerateQueryEmbedding(...args),
  embeddingToSql: (emb: number[]) => `[${emb.join(',')}]`,
}));

vi.mock('@/lib/cache/redis-client', () => ({
  withCache: (_key: string, fn: () => Promise<any>) => fn(),
  CACHE_TTL: { SEARCH_RESULTS: 60 },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { semanticSearch } from '../vector-search';

beforeEach(() => {
  mockQueryRawUnsafe.mockReset();
  mockGenerateQueryEmbedding.mockReset();
  mockGenerateQueryEmbedding.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
});

function getLastSql(): string {
  const lastCall = mockQueryRawUnsafe.mock.calls[mockQueryRawUnsafe.mock.calls.length - 1];
  return lastCall[0] as string;
}

describe('semanticSearch — retrocompatibilidade', () => {
  it('sem novas opções: inclui ramo document e legislative-act, exclui tribunal-decision', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('contrato administrativo', { useCache: false });

    const sql = getLastSql();
    expect(sql).toMatch(/FROM "DocumentChunk"/);
    expect(sql).toMatch(/FROM "LegislativeActChunk"/);
    expect(sql).not.toMatch(/FROM "TribunalDecisionChunk"/);
  });

  it('com includeTribunalDecisions=true: inclui o terceiro ramo', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('qualquer', { useCache: false, includeTribunalDecisions: true });

    const sql = getLastSql();
    expect(sql).toMatch(/FROM "TribunalDecisionChunk"/);
  });
});

describe('semanticSearch — excludeInactiveSumulas (filtro de súmulas TST)', () => {
  it('default (true) + includeTribunalDecisions: filtra CANCELADA/REVISTA dos 3 tipos canônicos TST', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('intervalo intrajornada', {
      useCache: false,
      includeTribunalDecisions: true,
    });

    const sql = getLastSql();
    expect(sql).toMatch(/FROM "TribunalDecisionChunk"/);
    // Filtro deve cobrir 3 tipos canônicos: sumula, orientacao_jurisprudencial, precedente_normativo
    expect(sql).toMatch(
      /NOT \(td\."decisionType" IN \('sumula', 'orientacao_jurisprudencial', 'precedente_normativo'\) AND \(td\.themes ILIKE '%situacao:CANCELADA%' OR td\.themes ILIKE '%situacao:REVISTA%'\)\)/,
    );
  });

  it('excludeInactiveSumulas=false (pergunta histórica): NÃO aplica o filtro', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('qual o entendimento antes da Reforma Trabalhista?', {
      useCache: false,
      includeTribunalDecisions: true,
      excludeInactiveSumulas: false,
    });

    const sql = getLastSql();
    expect(sql).toMatch(/FROM "TribunalDecisionChunk"/);
    expect(sql).not.toMatch(/situacao:CANCELADA/);
    expect(sql).not.toMatch(/situacao:REVISTA/);
  });

  it('sem TribunalDecisions: a flag não tem efeito (sem ramo C)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('busca normal', { useCache: false });

    const sql = getLastSql();
    expect(sql).not.toMatch(/FROM "TribunalDecisionChunk"/);
    expect(sql).not.toMatch(/situacao:CANCELADA/);
  });
});

describe('semanticSearch — categoryIn', () => {
  it('gera cláusula IN com valores da lista', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('query test', {
      useCache: false,
      categoryIn: ['acordao', 'informativo', 'manual-tcu'],
    });

    const sql = getLastSql();
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    expect(sql).toMatch(/d\."category" IN \(/);
    expect(params).toContain('acordao');
    expect(params).toContain('informativo');
    expect(params).toContain('manual-tcu');
  });
});

describe('semanticSearch — skipDocumentBranch / skipLegislativeActBranch', () => {
  it('skipDocumentBranch=true: omite o ramo DocumentChunk do UNION', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('query test', {
      useCache: false,
      skipDocumentBranch: true,
      includeTribunalDecisions: true,
    });

    const sql = getLastSql();
    expect(sql).not.toMatch(/FROM "DocumentChunk"/);
    expect(sql).toMatch(/FROM "LegislativeActChunk"/);
    expect(sql).toMatch(/FROM "TribunalDecisionChunk"/);
  });

  it('skipLegislativeActBranch=true: omite o ramo LegislativeActChunk', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('query test', {
      useCache: false,
      skipLegislativeActBranch: true,
    });

    const sql = getLastSql();
    expect(sql).toMatch(/FROM "DocumentChunk"/);
    expect(sql).not.toMatch(/FROM "LegislativeActChunk"/);
  });

  it('ambos skips + includeTribunalDecisions=true: só TribunalDecisionChunk', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('query test', {
      useCache: false,
      skipDocumentBranch: true,
      skipLegislativeActBranch: true,
      includeTribunalDecisions: true,
    });

    const sql = getLastSql();
    expect(sql).not.toMatch(/FROM "DocumentChunk"/);
    expect(sql).not.toMatch(/FROM "LegislativeActChunk"/);
    expect(sql).toMatch(/FROM "TribunalDecisionChunk"/);
  });
});

describe('semanticSearch — tribunalCodeFilter', () => {
  it('adiciona WHERE tribunalCode = ? ao ramo TribunalDecision', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('query test', {
      useCache: false,
      includeTribunalDecisions: true,
      tribunalCodeFilter: 'TCE-SP',
    });

    const sql = getLastSql();
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    // Fase 2.4: comparação case-insensitive via UPPER() em ambos os lados.
    expect(sql).toMatch(/UPPER\(td\."tribunalCode"\) = UPPER\(\$/);
    expect(params).toContain('TCE-SP');
  });
});

describe('semanticSearch — tribunalBoost', () => {
  it('sem tribunalBoost: SQL do decision_scores não tem multiplicador CASE', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('intervalo intrajornada', {
      useCache: false,
      includeTribunalDecisions: true,
    });

    const sql = getLastSql();
    expect(sql).toMatch(/decision_scores AS/);
    // Sem boost, similarity = 1 - cosine (sem multiplicação por CASE)
    expect(sql).not.toMatch(/td\."tribunalCode" = \$\d+ THEN/);
  });

  it('com tribunalBoost: aplica CASE WHEN td."tribunalCode" = $code THEN $factor', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('rescisão indireta por descumprimento de norma coletiva', {
      useCache: false,
      includeTribunalDecisions: true,
      tribunalBoost: { code: 'TST', factor: 1.2 },
    });

    const sql = getLastSql();
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    expect(sql).toMatch(/decision_scores AS/);
    expect(sql).toMatch(/CASE WHEN UPPER\(td\."tribunalCode"\) = UPPER\(\$\d+\) THEN \$\d+ ELSE 1/);
    expect(params).toContain('TST');
    expect(params).toContain(1.2);
  });

  it('tribunalBoost sem includeTribunalDecisions: SQL não tem o CASE (ramo não existe)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('query qualquer', {
      useCache: false,
      tribunalBoost: { code: 'TST', factor: 1.2 },
    });

    const sql = getLastSql();
    expect(sql).not.toMatch(/FROM "TribunalDecisionChunk"/);
    expect(sql).not.toMatch(/td\."tribunalCode" = \$\d+ THEN/);
    // Garante que o code não vazou para os params
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    expect(params).not.toContain('TST');
  });
});

describe('semanticSearch — extraWhere', () => {
  it('extraWhere.document adiciona fragmento ao WHERE do ramo DocumentChunk', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const { Prisma } = await import('@prisma/client');
    await semanticSearch('query test', {
      useCache: false,
      extraWhere: {
        document: Prisma.sql`d.year = ${2024}`,
      },
    });

    const sql = getLastSql();
    expect(sql).toMatch(/d\.year = \$/);
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    expect(params).toContain(2024);
  });

  it('extraWhere.tribunalDecision adiciona fragmento ao ramo TribunalDecisionChunk', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const { Prisma } = await import('@prisma/client');
    await semanticSearch('query test', {
      useCache: false,
      includeTribunalDecisions: true,
      extraWhere: {
        tribunalDecision: Prisma.sql`td.year = ${2023}`,
      },
    });

    const sql = getLastSql();
    expect(sql).toMatch(/td\.year = \$/);
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    expect(params).toContain(2023);
  });
});
