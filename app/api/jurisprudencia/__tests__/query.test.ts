// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSemanticSearch,
  mockEnrichSources,
  mockAdaptToSourcesPayload,
  mockMapFiltersToSemanticOptions,
  mockResolveEmenta,
  mockResolveFullText,
  mockCountUnifiedApproved,
  mockQueryGeminiText,
  mockSearchHistoryCreate,
  mockEnforceAiQuota,
  mockEnforceRateLimit,
  mockUserRole,
} = vi.hoisted(() => ({
  mockSemanticSearch: vi.fn(),
  mockEnrichSources: vi.fn(),
  mockAdaptToSourcesPayload: vi.fn(),
  mockMapFiltersToSemanticOptions: vi.fn(),
  mockResolveEmenta: vi.fn(),
  mockResolveFullText: vi.fn(),
  mockCountUnifiedApproved: vi.fn(),
  mockQueryGeminiText: vi.fn(),
  mockSearchHistoryCreate: vi.fn(),
  mockEnforceAiQuota: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  // Role injetada no ctx.user — mutável para testar o gate RBAC do bloco `debug`.
  mockUserRole: { value: 'student' },
}));

vi.mock('@/lib/cache/ai-quota', () => ({
  enforceAiQuota: (...args: any[]) => mockEnforceAiQuota(...args),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}));

vi.mock('@/lib/embeddings/vector-search', () => ({
  semanticSearch: (...args: any[]) => mockSemanticSearch(...args),
}));

vi.mock('@/lib/jurisprudencia/semantic-adapter', () => ({
  mapFiltersToSemanticOptions: (...args: any[]) => mockMapFiltersToSemanticOptions(...args),
  enrichSources: (...args: any[]) => mockEnrichSources(...args),
  adaptToSourcesPayload: (...args: any[]) => mockAdaptToSourcesPayload(...args),
  resolveEmenta: (...args: any[]) => mockResolveEmenta(...args),
  resolveFullText: (...args: any[]) => mockResolveFullText(...args),
}));

vi.mock('@/lib/jurisprudencia/unified-query', () => ({
  countUnifiedApproved: (...args: any[]) => mockCountUnifiedApproved(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    searchHistory: {
      create: (...args: any[]) => mockSearchHistoryCreate(...args),
    },
  },
}));

vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: any[]) => mockQueryGeminiText(...args),
}));

vi.mock('@/lib/api/handler', async () => {
  const { handleApiError } = await import('@/lib/errors/error-handler');
  return {
    withUserApi:
      (handler: any) =>
      async (req: any, ctx?: { params?: Promise<unknown> }) => {
        try {
          const params = ctx?.params ? await ctx.params : {};
          return await handler(req, {
            user: { userId: 'u1', email: 'u@x.com', role: mockUserRole.value },
            params,
            requestId: 'test',
            logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
          });
        } catch (err) {
          return handleApiError(err);
        }
      },
  };
});

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

process.env.GEMINI_API_KEY = 'test-key';

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/jurisprudencia/query/route';

const routeCtx = { params: Promise.resolve({}) };

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/jurisprudencia/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  mockSemanticSearch.mockReset();
  mockEnrichSources.mockReset();
  mockAdaptToSourcesPayload.mockReset();
  mockMapFiltersToSemanticOptions.mockReset();
  mockResolveEmenta.mockReset();
  mockResolveFullText.mockReset();
  mockCountUnifiedApproved.mockReset();
  mockQueryGeminiText.mockReset();
  mockSearchHistoryCreate.mockReset();
  mockEnforceAiQuota.mockReset();
  mockEnforceRateLimit.mockReset();
  mockEnforceAiQuota.mockResolvedValue({ action: 'allow' });
  mockEnforceRateLimit.mockResolvedValue(undefined);
  mockUserRole.value = 'student';

  // Default: adapter passes options through
  mockMapFiltersToSemanticOptions.mockReturnValue({
    skipLegislativeActBranch: true,
    includeTribunalDecisions: true,
  });
  mockResolveEmenta.mockReturnValue('ementa mock');
  mockResolveFullText.mockReturnValue(null);
  mockSearchHistoryCreate.mockResolvedValue({ id: 'sh-mock' });
});

describe('POST /api/jurisprudencia/query', () => {
  it('chama semanticSearch com a query e opções mapeadas', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [
        {
          documentId: 'td-1',
          documentTitle: 'Acórdão TCE-SP 1/24',
          category: 'acordao',
          chunkContent: 'trecho',
          chunkIndex: 0,
          similarity: 0.8,
          url: null,
          courseId: null,
          isCommon: true,
          tags: null,
          leiArticles: null,
          uploadedAt: '2024-01-01',
          sourceType: 'tribunal-decision',
        },
      ],
      query: 'pregão',
      totalFound: 1,
      latency: 100,
      cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([
      {
        documentId: 'td-1',
        similarity: 0.8,
        chunkContent: 'trecho',
        source: { kind: 'tribunal-decision', data: { id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'TCE-SP', decisionType: 'acordao', decisionNumber: '1/24', title: 't', ementa: 'e', summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticlesArr: [], url: null } },
      },
    ]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([
      {
        id: 'td-1',
        tribunalCode: 'TCE-SP',
        tribunalName: 'TCE-SP',
        decisionType: 'acordao',
        decisionNumber: '1/24',
        title: 't',
        relator: null,
        orgaoJulgador: null,
        dataJulgamento: null,
        url: null,
        sourceType: 'tribunal-decision',
        similarity: 0.8,
      },
    ]);
    mockQueryGeminiText.mockResolvedValueOnce({
      response: 'resposta',
      cached: false,
      latency: 50,
    });

    const res = await POST(makeReq({ query: 'pregão eletrônico', filters: { tribunal: 'TCE-SP' } }), routeCtx);
    expect(res.status).toBe(200);

    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      'juris-query:u1',
      10,
      60,
      { failureMode: 'closed' },
    );

    expect(mockMapFiltersToSemanticOptions).toHaveBeenCalledWith(
      expect.objectContaining({ tribunal: 'TCE-SP' })
    );
    expect(mockSemanticSearch).toHaveBeenCalledWith(
      'pregão eletrônico',
      expect.objectContaining({ skipLegislativeActBranch: true })
    );

    const body = await readJson(res);
    expect(body.answer).toBe('resposta');
    expect(body.consulted).toBe(1);
    expect(body.sources[0].tribunalCode).toBe('TCE-SP');
  });

  it('retorna mensagem de base vazia quando semanticSearch=[] e count=0', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [], query: 'q', totalFound: 0, latency: 10, cached: false,
    });
    mockCountUnifiedApproved.mockResolvedValueOnce(0);

    const res = await POST(makeReq({ query: 'qualquer coisa' }), routeCtx);
    const body = await readJson(res);

    expect(body.sources).toEqual([]);
    expect(body.consulted).toBe(0);
    expect(body.totalInDatabase).toBe(0);
    expect(body.answer).toMatch(/ainda não foi populada/);
  });

  it('retorna mensagem de filtros restritivos quando semanticSearch=[] mas count>0', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [], query: 'q', totalFound: 0, latency: 10, cached: false,
    });
    mockCountUnifiedApproved.mockResolvedValueOnce(500);

    const res = await POST(makeReq({ query: 'qualquer coisa' }), routeCtx);
    const body = await readJson(res);

    expect(body.totalInDatabase).toBe(500);
    expect(body.answer).toMatch(/Não encontrei decisões/);
  });

  it('fallback quando Gemini lança erro (retorna sources sem answer sintetizada)', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'td-1', documentTitle: 't', category: 'acordao', chunkContent: 'c', chunkIndex: 0, similarity: 0.8, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'td-1', similarity: 0.8, chunkContent: 'c',
      source: { kind: 'tribunal-decision', data: { id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao', decisionNumber: '1', title: 't', ementa: 'e', summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticlesArr: [], url: null } },
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao',
      decisionNumber: '1', title: 't', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'tribunal-decision', similarity: 0.8,
    }]);
    mockQueryGeminiText.mockRejectedValueOnce(new Error('gemini down'));

    const res = await POST(makeReq({ query: 'pergunta' }), routeCtx);
    const body = await readJson(res);

    expect(body.sources).toHaveLength(1);
    expect(body.answer).toMatch(/Não consegui gerar uma síntese/);
    // RBAC: aluno NÃO recebe a mensagem/stack de erro do Gemini no payload.
    expect(body.debug).toBeUndefined();
  });

  it('expõe debug do erro do Gemini apenas para admin', async () => {
    mockUserRole.value = 'admin';
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'td-1', documentTitle: 't', category: 'acordao', chunkContent: 'c', chunkIndex: 0, similarity: 0.8, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'td-1', similarity: 0.8, chunkContent: 'c',
      source: { kind: 'tribunal-decision', data: { id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao', decisionNumber: '1', title: 't', ementa: 'e', summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticlesArr: [], url: null } },
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao',
      decisionNumber: '1', title: 't', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'tribunal-decision', similarity: 0.8,
    }]);
    mockQueryGeminiText.mockRejectedValueOnce(new Error('gemini down'));

    const res = await POST(makeReq({ query: 'pergunta' }), routeCtx);
    const body = await readJson(res);

    expect(body.answer).toMatch(/Não consegui gerar uma síntese/);
    expect(body.debug).toBeDefined();
    expect(body.debug.geminiError).toBe('gemini down');
  });

  it('cita informativo TCU quando semanticSearch retorna informativo', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'inf-1', documentTitle: 'Informativo LC nº 42', category: 'informativo', chunkContent: 'trecho do informativo', chunkIndex: 0, similarity: 0.9, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'document' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'inf-1', similarity: 0.9, chunkContent: 'trecho do informativo',
      source: { kind: 'document', category: 'informativo', data: {
        id: 'inf-1', title: 'Informativo LC nº 42', category: 'informativo',
        tcuNumeroAcordao: null, tcuEmentaCompleta: null, description: 'resumo', content: null,
        tcuRelator: null, tcuAutorTese: null, tcuOrgaoJulgador: null,
        tcuDataJulgamento: null, tcuLinkPDF: null, summary: null, themes: null,
        leiArticlesArr: [], url: null, douData: null,
        uploadedAt: new Date(), updatedAt: new Date(), entityType: null, enunciadoNumber: null,
      }},
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'inf-1', tribunalCode: 'TCU', tribunalName: 'Tribunal de Contas da União',
      decisionType: 'informativo', decisionNumber: 'Informativo LC nº 42',
      title: 'Informativo LC nº 42', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'document-tcu-informativo', similarity: 0.9,
    }]);
    mockQueryGeminiText.mockResolvedValueOnce({ response: 'r', cached: false, latency: 10 });

    const res = await POST(makeReq({ query: 'segregação de funções' }), routeCtx);
    const body = await readJson(res);

    expect(body.sources[0].decisionType).toBe('informativo');
    expect(body.sources[0].tribunalCode).toBe('TCU');
  });

  it('passa filtros tais como ano, tema, dataFrom ao adapter', async () => {
    mockSemanticSearch.mockResolvedValueOnce({ results: [], query: 'q', totalFound: 0, latency: 10, cached: false });
    mockCountUnifiedApproved.mockResolvedValueOnce(0);

    await POST(makeReq({
      query: 'teste',
      filters: { year: 2024, theme: 'pregão', dataFrom: '2024-01-01' },
    }), routeCtx);

    expect(mockMapFiltersToSemanticOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        ano: 2024,
        tema: 'pregão',
        dataFrom: expect.any(Date),
      })
    );
  });

  it('persiste SearchHistory com type=jurisprudencia e retorna searchHistoryId', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'td-1', documentTitle: 't', category: 'acordao', chunkContent: 'c', chunkIndex: 0, similarity: 0.8, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'td-1', similarity: 0.8, chunkContent: 'c',
      source: { kind: 'tribunal-decision', data: { id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao', decisionNumber: '1', title: 't', ementa: 'e', summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticlesArr: [], url: null } },
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao',
      decisionNumber: '1', title: 't', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'tribunal-decision', similarity: 0.8,
    }]);
    mockQueryGeminiText.mockResolvedValueOnce({ response: 'r', cached: false, latency: 10 });
    mockSearchHistoryCreate.mockResolvedValueOnce({ id: 'sh-123' });

    const res = await POST(makeReq({ query: 'pregão', filters: { tribunal: 'TCE-SP' } }), routeCtx);
    const body = await readJson(res);

    expect(mockSearchHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          type: 'jurisprudencia',
          query: 'pregão',
          filters: expect.stringContaining('TCE-SP'),
          aiAnswer: 'r',
        }),
      }),
    );
    expect(body.searchHistoryId).toBe('sh-123');
  });

  it('inclui janela do inteiro teor no prompt quando resolveFullText retorna >= 500 chars', async () => {
    const longFullText = 'A '.repeat(1500) + 'PRINCÍPIO DA SEGREGAÇÃO DE FUNÇÕES — exige separação entre quem ordena, executa e fiscaliza despesa pública. ' + 'B '.repeat(1500);
    const chunkContent = 'PRINCÍPIO DA SEGREGAÇÃO DE FUNÇÕES — exige separação entre quem ordena, executa e fiscaliza despesa pública.';

    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'td-pe', documentTitle: 't', category: 'acordao', chunkContent, chunkIndex: 0, similarity: 0.9, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'td-pe', similarity: 0.9, chunkContent,
      source: { kind: 'tribunal-decision', data: { id: 'td-pe', tribunalCode: 'TCE-PE', tribunalName: 'TCE-PE', decisionType: 'acordao', decisionNumber: '698/26', title: 't', ementa: 'ementa curta', fullText: longFullText, summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticlesArr: [], url: null } },
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'td-pe', tribunalCode: 'TCE-PE', tribunalName: 'TCE-PE', decisionType: 'acordao',
      decisionNumber: '698/26', title: 't', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'tribunal-decision', similarity: 0.9,
    }]);
    mockResolveFullText.mockReturnValueOnce(longFullText);
    mockQueryGeminiText.mockResolvedValueOnce({ response: 'r', cached: false, latency: 10 });

    await POST(makeReq({ query: 'segregação de funções', filters: { tribunal: 'TCE-PE' } }), routeCtx);

    expect(mockQueryGeminiText).toHaveBeenCalled();
    const promptArg = mockQueryGeminiText.mock.calls[0][0] as string;
    expect(promptArg).toContain('Trecho do inteiro teor');
    expect(promptArg).toContain('PRINCÍPIO DA SEGREGAÇÃO DE FUNÇÕES');
    expect(promptArg).toContain('Use o trecho do inteiro teor quando disponível');
  });

  it('usa chunkContent como fallback quando resolveFullText retorna null', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'td-sp', documentTitle: 't', category: 'acordao', chunkContent: 'apenas o chunk pequeno', chunkIndex: 0, similarity: 0.8, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'td-sp', similarity: 0.8, chunkContent: 'apenas o chunk pequeno',
      source: { kind: 'tribunal-decision', data: { id: 'td-sp', tribunalCode: 'TCE-SP', tribunalName: 'TCE-SP', decisionType: 'acordao', decisionNumber: '1/24', title: 't', ementa: 'e', fullText: null, summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticlesArr: [], url: null } },
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'td-sp', tribunalCode: 'TCE-SP', tribunalName: 'TCE-SP', decisionType: 'acordao',
      decisionNumber: '1/24', title: 't', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'tribunal-decision', similarity: 0.8,
    }]);
    mockResolveFullText.mockReturnValueOnce(null);
    mockQueryGeminiText.mockResolvedValueOnce({ response: 'r', cached: false, latency: 10 });

    await POST(makeReq({ query: 'pregão', filters: { tribunal: 'TCE-SP' } }), routeCtx);

    const promptArg = mockQueryGeminiText.mock.calls[0][0] as string;
    expect(promptArg).toContain('Trecho relevante');
    expect(promptArg).toContain('apenas o chunk pequeno');
    expect(promptArg).not.toContain('Trecho do inteiro teor');
  });

  it('persiste SearchHistory mesmo quando semanticSearch=[] (analytics de falhas)', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [], query: 'q', totalFound: 0, latency: 10, cached: false,
    });
    mockCountUnifiedApproved.mockResolvedValueOnce(500);
    mockSearchHistoryCreate.mockResolvedValueOnce({ id: 'sh-empty' });

    const res = await POST(makeReq({ query: 'tese obscura' }), routeCtx);
    const body = await readJson(res);

    expect(mockSearchHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'jurisprudencia',
          aiAnswer: null,
        }),
      }),
    );
    expect(body.searchHistoryId).toBe('sh-empty');
  });

  it('degrade-search: retorna sources SEM chamar o Gemini (kill-switch global)', async () => {
    mockEnforceAiQuota.mockResolvedValue({ action: 'degrade-search', reason: 'global' });
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'td-1', documentTitle: 't', category: 'acordao', chunkContent: 'c', chunkIndex: 0, similarity: 0.8, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'td-1', similarity: 0.8, chunkContent: 'c',
      source: { kind: 'tribunal-decision', data: { id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao', decisionNumber: '1', title: 't', ementa: 'e', summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticlesArr: [], url: null } },
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao',
      decisionNumber: '1', title: 't', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'tribunal-decision', similarity: 0.8,
    }]);

    const res = await POST(makeReq({ query: 'pregão', filters: { tribunal: 'TCE-SP' } }), routeCtx);
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(mockQueryGeminiText).not.toHaveBeenCalled();
    expect(body.sources).toHaveLength(1);
    expect(body.answer).toMatch(/alta demanda/i);
  });

  it('degrade-search: persiste SearchHistory com aiAnswer null', async () => {
    mockEnforceAiQuota.mockResolvedValue({ action: 'degrade-search', reason: 'global' });
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'td-1', documentTitle: 't', category: 'acordao', chunkContent: 'c', chunkIndex: 0, similarity: 0.8, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'td-1', similarity: 0.8, chunkContent: 'c',
      source: { kind: 'tribunal-decision', data: { id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao', decisionNumber: '1', title: 't', ementa: 'e', summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticlesArr: [], url: null } },
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao',
      decisionNumber: '1', title: 't', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'tribunal-decision', similarity: 0.8,
    }]);
    mockSearchHistoryCreate.mockResolvedValueOnce({ id: 'sh-degraded' });

    const res = await POST(makeReq({ query: 'pregão', filters: { tribunal: 'TCE-SP' } }), routeCtx);
    const body = await readJson(res);

    expect(mockSearchHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ aiAnswer: null }) }),
    );
    expect(body.searchHistoryId).toBe('sh-degraded');
  });

  // --- Cobertura de branches de montagem de prompt e guardas ---
  function setupOne(
    over: { payload?: Record<string, unknown>; data?: Record<string, unknown> } = {},
    opts: { fullText?: string | null; chunk?: string } = {},
  ) {
    const chunk = opts.chunk ?? 'trecho relevante do acórdão';
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'x', documentTitle: 't', category: 'acordao', chunkContent: chunk, chunkIndex: 0, similarity: 0.9, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'x', similarity: 0.9, chunkContent: chunk,
      source: { kind: 'tribunal-decision', data: { id: 'x', summary: null, themes: null, leiArticlesArr: [], ...over.data } },
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'x', tribunalCode: 'TCU', tribunalName: 'TCU', decisionType: 'acordao', decisionNumber: '1/24',
      title: 't', relator: 'Rel', orgaoJulgador: 'Plenário', dataJulgamento: null, url: null,
      sourceType: 'tribunal-decision', similarity: 0.9, ...over.payload,
    }]);
    mockResolveFullText.mockReturnValueOnce(opts.fullText ?? null);
    mockQueryGeminiText.mockResolvedValueOnce({ response: 'resposta', cached: false, latency: 10 });
  }

  it('rejeita corpo inválido com 422 (validação Zod)', async () => {
    const res = await POST(makeReq({ semQuery: true }), routeCtx);
    expect(res.status).toBe(422);
    expect(mockSemanticSearch).not.toHaveBeenCalled();
  });

  it('inclui data de julgamento e artigos da Lei no bloco de contexto', async () => {
    setupOne({ payload: { dataJulgamento: new Date('2024-05-20') }, data: { leiArticlesArr: ['75', '6'] } });
    await POST(makeReq({ query: 'dispensa', filters: { dataTo: '2024-12-31' } }), routeCtx);
    const prompt = mockQueryGeminiText.mock.calls[0][0] as string;
    expect(prompt).toMatch(/Artigos Lei 14\.133:.*75/);
  });

  it('inteiro teor abaixo do limite entra inteiro, sem janela de corte', async () => {
    // >= FULLTEXT_MIN_LENGTH (para virar "inteiro teor") e <= MAX (sem janela)
    const ft = 'Inteiro teor completo do acórdão. ' + 'palavra '.repeat(120);
    setupOne({}, { fullText: ft });
    await POST(makeReq({ query: 'dispensa' }), routeCtx);
    const prompt = mockQueryGeminiText.mock.calls[0][0] as string;
    expect(prompt).toContain('Trecho do inteiro teor');
    expect(prompt).toContain('Inteiro teor completo do acórdão');
  });

  it('inteiro teor longo sem âncora no chunk usa o início truncado', async () => {
    // fullText > 4000 chars mas o chunk não aparece nele → idx === -1 → slice(0, MAX)
    const longo = 'Z'.repeat(5000);
    setupOne({}, { fullText: longo, chunk: 'ancora que nao existe no inteiro teor longo aqui' });
    await POST(makeReq({ query: 'dispensa' }), routeCtx);
    const prompt = mockQueryGeminiText.mock.calls[0][0] as string;
    expect(prompt).toContain('ZZZ');
    expect(prompt).toContain('...');
  });

  it('inteiro teor longo com chunk curto (âncora <30) usa o início truncado', async () => {
    // chunk < 30 chars → não tenta ancorar (anchor.length > 30 falso) → slice(0, MAX)
    setupOne({}, { fullText: 'Q'.repeat(6000), chunk: 'abc' });
    await POST(makeReq({ query: 'dispensa' }), routeCtx);
    const prompt = mockQueryGeminiText.mock.calls[0][0] as string;
    expect(prompt).toContain('QQQ');
    expect(prompt).toContain('...');
  });

  it('trunca ementa longa com reticências no bloco de contexto', async () => {
    setupOne();
    mockResolveEmenta.mockReset();
    mockResolveEmenta.mockReturnValue('E'.repeat(3000)); // > MAX_EMENTA_CHARS
    await POST(makeReq({ query: 'dispensa' }), routeCtx);
    const prompt = mockQueryGeminiText.mock.calls[0][0] as string;
    expect(prompt).toContain('...');
  });

  it('todos os resultados órfãos (enriched vazio) retorna sem sintetizar', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'x', documentTitle: 't', category: 'acordao', chunkContent: 'c', chunkIndex: 0, similarity: 0.8, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([]); // todos órfãos
    const res = await POST(makeReq({ query: 'dispensa' }), routeCtx);
    expect(res.status).toBe(200);
    expect(mockQueryGeminiText).not.toHaveBeenCalled();
  });

  it('janela do inteiro teor com âncora no meio recebe reticências dos dois lados', async () => {
    const anchor = 'PRINCÍPIO DA SEGREGAÇÃO DE FUNÇÕES na administração pública';
    const ft = 'X'.repeat(3000) + anchor + 'Y'.repeat(3000); // > 4000, âncora no meio
    setupOne({}, { fullText: ft, chunk: anchor });
    await POST(makeReq({ query: 'segregação' }), routeCtx);
    const prompt = mockQueryGeminiText.mock.calls[0][0] as string;
    // âncora encontrada no meio → janela com '...' antes e depois
    expect(prompt).toContain(anchor);
    expect(prompt).toContain('...');
  });

  it('resposta vazia do Gemini cai no fallback (sources presentes, aiAnswer nula no histórico)', async () => {
    setupOne();
    // sobrescreve o mock de resposta para vir vazio (só espaços) → empty-response
    mockQueryGeminiText.mockReset();
    mockQueryGeminiText.mockResolvedValueOnce({ response: '   ', cached: false, latency: 10 });
    const res = await POST(makeReq({ query: 'dispensa' }), routeCtx);
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.sources).toHaveLength(1);
    expect(body.answer).toMatch(/Não consegui gerar uma síntese/i);
    // histórico persiste com aiAnswer null
    expect(mockSearchHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ aiAnswer: null }) }),
    );
  });
});
