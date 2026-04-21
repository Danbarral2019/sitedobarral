// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFetchUnifiedTopK,
  mockCountUnifiedApproved,
  mockQueryGeminiText,
} = vi.hoisted(() => ({
  mockFetchUnifiedTopK: vi.fn(),
  mockCountUnifiedApproved: vi.fn(),
  mockQueryGeminiText: vi.fn(),
}));

vi.mock('@/lib/jurisprudencia/unified-query', () => ({
  fetchUnifiedTopK: (...args: any[]) => mockFetchUnifiedTopK(...args),
  countUnifiedApproved: (...args: any[]) => mockCountUnifiedApproved(...args),
}));

vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: any[]) => mockQueryGeminiText(...args),
}));

vi.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: any) => (req: any, ctx?: any) =>
    handler(req, {
      ...ctx,
      user: { userId: 'u1', email: 'u@x.com', role: 'student' },
    }),
}));

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
  mockFetchUnifiedTopK.mockReset();
  mockCountUnifiedApproved.mockReset();
  mockQueryGeminiText.mockReset();
});

describe('POST /api/jurisprudencia/query', () => {
  it('chama fetchUnifiedTopK com os filtros do body', async () => {
    mockFetchUnifiedTopK.mockResolvedValueOnce([
      {
        id: 'doc-1',
        tribunalCode: 'TCU',
        tribunalName: 'Tribunal de Contas da União',
        decisionType: 'acordao',
        decisionNumber: 'AC-1/24',
        title: 'Acórdão TCU',
        ementa: 'e',
        summary: null,
        relator: null,
        orgaoJulgador: null,
        dataJulgamento: null,
        themes: null,
        leiArticles: null,
        url: null,
      },
    ]);
    mockQueryGeminiText.mockResolvedValueOnce({
      response: 'resposta sintetizada',
      cached: false,
      latency: 123,
    });

    const res = await POST(
      makeReq({
        query: 'sobre pregão',
        filters: { tribunal: 'TCU' },
      })
    );

    expect(res.status).toBe(200);
    expect(mockFetchUnifiedTopK).toHaveBeenCalledWith(
      expect.objectContaining({ tribunal: 'TCU' }),
      expect.any(Number)
    );

    const body = await readJson(res);
    expect(body.answer).toBe('resposta sintetizada');
    expect(body.consulted).toBe(1);
    expect(body.sources[0].tribunalCode).toBe('TCU');
  });

  it('retorna mensagem de base vazia quando countUnifiedApproved=0', async () => {
    mockFetchUnifiedTopK.mockResolvedValueOnce([]);
    mockCountUnifiedApproved.mockResolvedValueOnce(0);

    const res = await POST(makeReq({ query: 'qualquer coisa' }));
    const body = await readJson(res);

    expect(body.sources).toEqual([]);
    expect(body.consulted).toBe(0);
    expect(body.totalInDatabase).toBe(0);
    expect(body.answer).toMatch(/ainda não foi populada/);
  });

  it('retorna mensagem de filtros restritivos quando topK=[] mas count>0', async () => {
    mockFetchUnifiedTopK.mockResolvedValueOnce([]);
    mockCountUnifiedApproved.mockResolvedValueOnce(500);

    const res = await POST(makeReq({ query: 'qualquer coisa' }));
    const body = await readJson(res);

    expect(body.totalInDatabase).toBe(500);
    expect(body.answer).toMatch(/afrouxar os filtros/);
  });

  it('mantém fallback quando Gemini lança erro (retorna sources sem answer)', async () => {
    mockFetchUnifiedTopK.mockResolvedValueOnce([
      {
        id: 'td-1',
        tribunalCode: 'TCE-SP',
        tribunalName: 'TCE-SP',
        decisionType: 'acordao',
        decisionNumber: '1/24',
        title: 'T',
        ementa: 'e',
        summary: null,
        relator: null,
        orgaoJulgador: null,
        dataJulgamento: null,
        themes: null,
        leiArticles: null,
        url: null,
      },
    ]);
    mockQueryGeminiText.mockRejectedValueOnce(new Error('gemini down'));

    const res = await POST(makeReq({ query: 'pergunta' }));
    const body = await readJson(res);

    expect(body.sources).toHaveLength(1);
    expect(body.answer).toMatch(/Não consegui gerar uma síntese/);
  });
});
