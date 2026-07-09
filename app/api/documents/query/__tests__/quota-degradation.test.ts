// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyAuth,
  mockCheckRateLimit,
  mockEnforceAiQuota,
  mockAssembleAnswerContext,
  mockGenerateStream,
  mockQueryGeminiText,
} = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockEnforceAiQuota: vi.fn(),
  mockAssembleAnswerContext: vi.fn(),
  mockGenerateStream: vi.fn(),
  mockQueryGeminiText: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

vi.mock('@/lib/cache/redis-client', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  withCache: async (_key: string, fn: () => Promise<unknown>) => fn(),
  CACHE_TTL: { GEMINI_QUERY: 86400, SEARCH_RESULTS: 3600 },
}));

vi.mock('@/lib/cache/ai-quota', () => ({
  enforceAiQuota: (...args: unknown[]) => mockEnforceAiQuota(...args),
}));

vi.mock('@/lib/rag/answerContext', () => ({
  assembleAnswerContext: (...args: unknown[]) => mockAssembleAnswerContext(...args),
}));

// BIA-0c: a rota busca matrículas (prisma.user.findUnique) para pós-filtrar.
// Mock hermético para não depender de banco real em teste.
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: async () => ({ enrollments: [] }) } },
}));

vi.mock('@/lib/embeddings/citation-validator', () => ({
  validateQuotedCitations: () => ({ invalidQuotes: [], totalQuotes: 0 }),
  buildCitationWarning: () => '',
}));

vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: unknown[]) => mockQueryGeminiText(...args),
}));

vi.mock('@/lib/gemini/config', () => ({
  PRIMARY_GEMINI_MODEL: 'gemini-test',
  FALLBACK_GEMINI_MODELS: [],
}));

vi.mock('@/lib/ai', () => ({
  generateStream: (...args: unknown[]) => mockGenerateStream(...args),
  LEGAL_SAFETY_SETTINGS: [],
}));

vi.mock('@/lib/monitoring/events', () => ({
  trackServerEvent: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/documents/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Gera um async-iterable de streaming com um único token (fonte fresca por chamada).
function oneToken() {
  return (async function* () {
    yield { text: 'resposta sintetizada', finishReason: 'end_turn' };
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
  allDisplayResults: [{ chunkContent: 'conteúdo' }],
  maxSimilarity: 0.7,
  citationDocuments: [],
};

describe('/api/documents/query — degradação por quota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ valid: true, user: { userId: 'u1', role: 'student' } });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, limit: 10, remaining: 9, reset: 0 });
    mockEnforceAiQuota.mockResolvedValue({ action: 'allow' });
    mockAssembleAnswerContext.mockResolvedValue(READY_CTX);
    mockGenerateStream.mockImplementation(async () => oneToken());
    mockQueryGeminiText.mockResolvedValue({ response: 'resposta gemini' });
  });

  it('non-stream + allow → sintetiza via Gemini (queryGeminiText chamado)', async () => {
    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: false }));
    const body = await res.json();
    expect(mockQueryGeminiText).toHaveBeenCalledTimes(1);
    expect(body.synthesizedAnswer).toBe('resposta gemini');
  });

  it('non-stream + degrade-search → NÃO sintetiza, retorna resultados sem synthesizedAnswer', async () => {
    mockEnforceAiQuota.mockResolvedValue({ action: 'degrade-search', reason: 'global' });

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: false }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockQueryGeminiText).not.toHaveBeenCalled();
    expect(body.synthesizedAnswer).toBeUndefined();
    expect(body.results).toHaveLength(1); // busca segue entregando resultados
  });

  it('stream + allow → tenta o Claude (provider anthropic) primeiro', async () => {
    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: true }));
    await res.text();

    expect(mockGenerateStream).toHaveBeenCalled();
    expect(mockGenerateStream.mock.calls[0][1]).toMatchObject({ provider: 'anthropic' });
  });

  it('stream + degrade-gemini → pula o Claude e vai direto ao Gemini', async () => {
    mockEnforceAiQuota.mockResolvedValue({ action: 'degrade-gemini', reason: 'daily' });

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: true }));
    const text = await res.text();

    // nenhuma chamada ao Claude
    const providers = mockGenerateStream.mock.calls.map((c) => (c[1] as { provider: string }).provider);
    expect(providers).not.toContain('anthropic');
    expect(providers).toContain('gemini');
    expect(text).toContain('resposta sintetizada');
  });

  it('stream + degrade-search → não chama LLM nenhum e sinaliza degradação', async () => {
    mockEnforceAiQuota.mockResolvedValue({ action: 'degrade-search', reason: 'global' });

    const res = await POST(makeReq({ query: 'dispensa de licitação', stream: true }));
    const text = await res.text();

    expect(mockGenerateStream).not.toHaveBeenCalled();
    expect(text).toContain('data: [DONE]');
    // sinaliza ao frontend que o card de IA foi degradado
    expect(text).toContain('AI_QUOTA_DEGRADED');
  });
});
