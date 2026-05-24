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
            user: { userId: 'u1', email: 'u@x.com', role: 'student' },
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

import { POST } from '@/app/api/jurisprudencia/query/route';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/jurisprudencia/query', {
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

    const res = await POST(makeReq({ query: 'pregão eletrônico', filters: { tribunal: 'TCE-SP' } }));
    expect(res.status).toBe(200);

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

    const res = await POST(makeReq({ query: 'qualquer coisa' }));
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

    const res = await POST(makeReq({ query: 'qualquer coisa' }));
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

    const res = await POST(makeReq({ query: 'pergunta' }));
    const body = await readJson(res);

    expect(body.sources).toHaveLength(1);
    expect(body.answer).toMatch(/Não consegui gerar uma síntese/);
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

    const res = await POST(makeReq({ query: 'segregação de funções' }));
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
    }));

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

    const res = await POST(makeReq({ query: 'pregão', filters: { tribunal: 'TCE-SP' } }));
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

    await POST(makeReq({ query: 'segregação de funções', filters: { tribunal: 'TCE-PE' } }));

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

    await POST(makeReq({ query: 'pregão', filters: { tribunal: 'TCE-SP' } }));

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

    const res = await POST(makeReq({ query: 'tese obscura' }));
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
});
