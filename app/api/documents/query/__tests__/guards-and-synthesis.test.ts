// @vitest-environment node
/**
 * Testes das guardas (auth/rate-limit/validação/contexto vazio) e dos
 * caminhos de robustez do streaming SSE do chat RAG (POST /api/documents/query).
 * Complementa quota-degradation.test.ts (síntese/degradação) e
 * quota-exhausted.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyAuth,
  mockCheckRateLimit,
  mockEnforceAiQuota,
  mockAssembleAnswerContext,
  mockGenerateStream,
  mockQueryGeminiText,
  mockUserFindUnique,
  mockValidateQuotes,
} = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockEnforceAiQuota: vi.fn(),
  mockAssembleAnswerContext: vi.fn(),
  mockGenerateStream: vi.fn(),
  mockQueryGeminiText: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockValidateQuotes: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }));
vi.mock('@/lib/cache/redis-client', () => ({
  checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
  withCache: async (_k: string, fn: () => Promise<unknown>) => fn(),
  CACHE_TTL: { GEMINI_QUERY: 86400, SEARCH_RESULTS: 3600 },
}));
vi.mock('@/lib/cache/ai-quota', () => ({ enforceAiQuota: (...a: unknown[]) => mockEnforceAiQuota(...a) }));
vi.mock('@/lib/rag/answerContext', () => ({ assembleAnswerContext: (...a: unknown[]) => mockAssembleAnswerContext(...a) }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) } } }));
vi.mock('@/lib/embeddings/citation-validator', () => ({
  validateQuotedCitations: (...a: unknown[]) => mockValidateQuotes(...a),
  buildCitationWarning: (quotes: string[]) => `⚠️ aspas não verificadas: ${quotes.length}`,
}));
vi.mock('@/lib/gemini/cached-client', () => ({ queryGeminiText: (...a: unknown[]) => mockQueryGeminiText(...a) }));
vi.mock('@/lib/gemini/config', () => ({ PRIMARY_GEMINI_MODEL: 'gemini-test', FALLBACK_GEMINI_MODELS: ['gemini-test', 'gemini-fb'] }));
vi.mock('@/lib/ai', () => ({ generateStream: (...a: unknown[]) => mockGenerateStream(...a), LEGAL_SAFETY_SETTINGS: [] }));
vi.mock('@/lib/monitoring/events', () => ({ trackServerEvent: vi.fn() }));
vi.mock('@/lib/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/documents/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Gerador de stream configurável
function streamOf(chunks: Array<Record<string, unknown>>) {
  return (async function* () {
    for (const c of chunks) yield c;
  })();
}

const READY_CTX = {
  empty: false,
  cached: false,
  totalFound: 1,
  systemInstruction: 'sys',
  synthesisPrompt: 'prompt',
  formattedResults: [{ documentId: 'd1', documentTitle: 'Doc' }],
  legalSources: [],
  allDisplayResults: [{ chunkContent: 'conteúdo do chunk' }],
  maxSimilarity: 0.7,
  citationDocuments: [],
};

async function sse(res: Response): Promise<string> {
  return res.text();
}

describe('/api/documents/query — guardas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ valid: true, user: { userId: 'u1', role: 'student' } });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, limit: 10, remaining: 9, reset: 0 });
    mockEnforceAiQuota.mockResolvedValue({ action: 'allow' });
    mockAssembleAnswerContext.mockResolvedValue(READY_CTX);
    mockUserFindUnique.mockResolvedValue({ enrollments: [{ courseId: '3' }] });
    mockValidateQuotes.mockReturnValue({ invalidQuotes: [], totalQuotes: 0 });
    mockQueryGeminiText.mockResolvedValue({ response: 'resposta gemini' });
  });

  it('401 quando não autenticado', async () => {
    mockVerifyAuth.mockResolvedValue({ valid: false, user: null });
    const res = await POST(makeReq({ query: 'dispensa de licitação' }));
    expect(res.status).toBe(401);
  });

  it('429 quando estoura o rate limit (não-admin)', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, limit: 10, remaining: 0, reset: 0 });
    const res = await POST(makeReq({ query: 'dispensa de licitação' }));
    expect(res.status).toBe(429);
  });

  it('400 quando a query tem menos de 3 caracteres', async () => {
    const res = await POST(makeReq({ query: 'ab' }));
    expect(res.status).toBe(400);
  });

  it('400 quando maxResults está fora do intervalo permitido', async () => {
    expect((await POST(makeReq({ query: 'dispensa', maxResults: 0 }))).status).toBe(400);
    expect((await POST(makeReq({ query: 'dispensa', maxResults: 99 }))).status).toBe(400);
  });

  it('admin não é limitado por rate limit e recebe todos os cursos', async () => {
    mockVerifyAuth.mockResolvedValue({ valid: true, user: { userId: 'adm', role: 'admin' } });
    await POST(makeReq({ query: 'dispensa de licitação', stream: false }));
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    // admin não consulta enrollments no banco
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('contexto vazio retorna results:[] e totalDocuments:0', async () => {
    mockAssembleAnswerContext.mockResolvedValue({ empty: true, cached: false });
    const res = await POST(makeReq({ query: 'tema sem resultado', stream: false }));
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.totalDocuments).toBe(0);
  });
});

describe('/api/documents/query — robustez do streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ valid: true, user: { userId: 'u1', role: 'student' } });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, limit: 10, remaining: 9, reset: 0 });
    mockEnforceAiQuota.mockResolvedValue({ action: 'allow' });
    mockAssembleAnswerContext.mockResolvedValue(READY_CTX);
    mockUserFindUnique.mockResolvedValue({ enrollments: [] });
    mockValidateQuotes.mockReturnValue({ invalidQuotes: [], totalQuotes: 0 });
  });

  it('encaminha eventos de citação do Claude', async () => {
    mockGenerateStream.mockImplementation(async () =>
      streamOf([{ text: 'resposta', citation: { cited_text: 'x' }, finishReason: 'end_turn' }]),
    );
    const text = await sse(await POST(makeReq({ query: 'dispensa licitação', stream: true })));
    expect(text).toContain('"type":"citation"');
  });

  it('anota quando o finishReason é anormal (ex. SAFETY)', async () => {
    mockGenerateStream.mockImplementation(async () =>
      streamOf([{ text: 'parcial', finishReason: 'SAFETY' }]),
    );
    const text = await sse(await POST(makeReq({ query: 'dispensa licitação', stream: true })));
    expect(text).toMatch(/interrompida antes do final/i);
  });

  it('emite fallback quando o stream não produz tokens', async () => {
    mockGenerateStream.mockImplementation(async () => streamOf([{ finishReason: 'end_turn' }]));
    const text = await sse(await POST(makeReq({ query: 'dispensa licitação', stream: true })));
    expect(text).toMatch(/Não consegui sintetizar/i);
  });

  it('Claude falha antes de qualquer token → fallback para Gemini', async () => {
    let call = 0;
    mockGenerateStream.mockImplementation(async (_task: string, opts: { provider: string }) => {
      call++;
      if (opts.provider === 'anthropic') throw new Error('claude down');
      return streamOf([{ text: 'via gemini', finishReason: 'end_turn' }]);
    });
    const text = await sse(await POST(makeReq({ query: 'dispensa licitação', stream: true })));
    expect(text).toContain('via gemini');
    expect(call).toBeGreaterThanOrEqual(2);
  });

  it('valida aspas no caminho Gemini e injeta aviso quando há aspas inválidas', async () => {
    mockEnforceAiQuota.mockResolvedValue({ action: 'degrade-gemini', reason: 'daily' });
    mockGenerateStream.mockImplementation(async () =>
      streamOf([{ text: 'resposta "citação falsa"', finishReason: 'end_turn' }]),
    );
    mockValidateQuotes.mockReturnValue({ invalidQuotes: ['citação falsa'], totalQuotes: 1 });
    const text = await sse(await POST(makeReq({ query: 'dispensa licitação', stream: true })));
    expect(text).toMatch(/aspas não verificadas/i);
  });

  it('erro de quota mid-stream vira evento QUOTA_EXHAUSTED', async () => {
    mockGenerateStream.mockImplementation(async () => {
      throw new Error('429 RESOURCE_EXHAUSTED quota');
    });
    const text = await sse(await POST(makeReq({ query: 'dispensa licitação', stream: true })));
    expect(text).toContain('QUOTA_EXHAUSTED');
  });

  it('Claude que falha DEPOIS de emitir tokens não troca de provider (fallback genérico)', async () => {
    mockGenerateStream.mockImplementation(async () =>
      (async function* () {
        yield { text: 'começo da resposta' };
        throw new Error('conexão caiu no meio');
      })(),
    );
    const text = await sse(await POST(makeReq({ query: 'dispensa licitação', stream: true })));
    // token inicial chegou ao cliente e o erro caiu no fallback genérico (não QUOTA)
    expect(text).toContain('começo da resposta');
    expect(text).toMatch(/Não consegui sintetizar/i);
    expect(text).not.toContain('QUOTA_EXHAUSTED');
  });

  it('não quebra o stream se o validador de aspas lançar', async () => {
    mockEnforceAiQuota.mockResolvedValue({ action: 'degrade-gemini', reason: 'daily' });
    mockGenerateStream.mockImplementation(async () =>
      streamOf([{ text: 'resposta com "aspas"', finishReason: 'end_turn' }]),
    );
    mockValidateQuotes.mockImplementation(() => { throw new Error('validator boom'); });
    const text = await sse(await POST(makeReq({ query: 'dispensa licitação', stream: true })));
    // a resposta segue e o stream termina normalmente apesar do erro no validador
    expect(text).toContain('resposta com');
    expect(text).toContain('data: [DONE]');
  });
});
