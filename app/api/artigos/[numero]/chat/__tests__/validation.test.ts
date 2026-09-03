// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  enforceGlobalAiCap: vi.fn(),
  queryGeminiText: vi.fn(),
  documentFindMany: vi.fn(),
  legislativeActFindMany: vi.fn(),
  articleQuestionFindMany: vi.fn(),
  articleQuestionCreate: vi.fn(),
  articleQuestionUpdate: vi.fn(),
  findRelatedArticles: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...args: unknown[]) => mocks.enforceRateLimit(...args),
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/cache/ai-quota', () => ({
  enforceGlobalAiCap: (...args: unknown[]) => mocks.enforceGlobalAiCap(...args),
}));
vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: unknown[]) => mocks.queryGeminiText(...args),
}));
vi.mock('@/lib/gemini/config', () => ({
  PRIMARY_GEMINI_MODEL: 'gemini-test',
  PREMIUM_GEMINI_MODEL: 'gemini-premium-test',
  isPremiumChatQuery: () => false,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: (...args: unknown[]) => mocks.documentFindMany(...args) },
    legislativeAct: { findMany: (...args: unknown[]) => mocks.legislativeActFindMany(...args) },
    articleQuestion: {
      findMany: (...args: unknown[]) => mocks.articleQuestionFindMany(...args),
      create: (...args: unknown[]) => mocks.articleQuestionCreate(...args),
      update: (...args: unknown[]) => mocks.articleQuestionUpdate(...args),
    },
  },
}));
vi.mock('@/data/lei-14133-artigos', () => ({
  LEI_14133_ARTIGOS: {
    '75': {
      numero: '75',
      titulo: 'Da contratação direta',
      capitulo: 'Contratação direta',
      capituloCompleto: 'CAPÍTULO VIII',
      ementa: 'Art. 75. É dispensável a licitação nas hipóteses previstas em lei.',
    },
    '76': {
      numero: '76',
      titulo: 'Da alienação',
      capitulo: 'Alienação',
      capituloCompleto: 'CAPÍTULO IX',
      ementa: 'Art. 76. A alienação de bens observará as condições legais.',
    },
  },
}));
vi.mock('@/data/lei-14133-cross-references', () => ({
  findRelatedArticles: (...args: unknown[]) => mocks.findRelatedArticles(...args),
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET, POST } from '../route';

const routeCtx = { params: Promise.resolve({ numero: '75' }) };

function makePost(body: Record<string, unknown>, token?: string): NextRequest {
  return new NextRequest('http://localhost/api/artigos/75/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeGet(conversationId: string, token?: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/artigos/75/chat?conversationId=${conversationId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
}

describe('/api/artigos/[numero]/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('JWT_SECRET', 'test-secret-key-for-conversation-token-32-chars');
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.enforceGlobalAiCap.mockResolvedValue({ action: 'allow' });
    mocks.documentFindMany.mockResolvedValue([]);
    mocks.legislativeActFindMany.mockResolvedValue([]);
    mocks.articleQuestionFindMany.mockResolvedValue([]);
    mocks.articleQuestionCreate.mockResolvedValue({ id: 'question-1' });
    mocks.articleQuestionUpdate.mockResolvedValue({ id: 'question-1' });
    mocks.queryGeminiText.mockResolvedValue({ response: 'Resposta', cached: false, latency: 1 });
    mocks.findRelatedArticles.mockReturnValue({ articles: [], topics: [] });
  });

  it('rejeita pergunta acima de 1.000 caracteres antes de banco ou IA', async () => {
    const response = await POST(makePost({ question: 'a'.repeat(1001) }), routeCtx);

    expect(response.status).toBe(400);
    expect(mocks.enforceGlobalAiCap).not.toHaveBeenCalled();
    expect(mocks.documentFindMany).not.toHaveBeenCalled();
    expect(mocks.queryGeminiText).not.toHaveBeenCalled();
  });

  it('consulta somente documentos públicos e retorna token assinado', async () => {
    mocks.findRelatedArticles.mockReturnValue({ articles: ['76'], topics: ['alienação'] });
    const response = await POST(makePost({ question: 'Quando cabe dispensa?' }), routeCtx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.conversationToken).toEqual(expect.any(String));
    expect(mocks.documentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [expect.any(Object), { isPublic: true }] },
      }),
    );
    expect(mocks.documentFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { AND: [expect.any(Object), { isPublic: true }] },
      }),
    );
  });

  it('rejeita follow-up sem token mesmo com conversationId válido', async () => {
    const conversationId = '550e8400-e29b-41d4-a716-446655440000';
    const response = await POST(
      makePost({ question: 'E os limites?', conversationId }),
      routeCtx,
    );

    expect(response.status).toBe(401);
    expect(mocks.articleQuestionFindMany).not.toHaveBeenCalled();
  });

  it('permite follow-up e GET apenas com token da mesma conversa', async () => {
    const initial = await POST(makePost({ question: 'Quando cabe dispensa?' }), routeCtx);
    const initialBody = await initial.json();

    const followUp = await POST(
      makePost(
        { question: 'E os limites?', conversationId: initialBody.conversationId },
        initialBody.conversationToken,
      ),
      routeCtx,
    );
    expect(followUp.status).toBe(200);

    const withoutToken = await GET(makeGet(initialBody.conversationId), routeCtx);
    expect(withoutToken.status).toBe(401);

    const history = await GET(
      makeGet(initialBody.conversationId, initialBody.conversationToken),
      routeCtx,
    );
    expect(history.status).toBe(200);
  });

  it('rejeita token válido emitido para outra conversa', async () => {
    const initial = await POST(makePost({ question: 'Quando cabe dispensa?' }), routeCtx);
    const initialBody = await initial.json();

    const response = await POST(
      makePost(
        {
          question: 'E os limites?',
          conversationId: '550e8400-e29b-41d4-a716-446655440000',
        },
        initialBody.conversationToken,
      ),
      routeCtx,
    );

    expect(response.status).toBe(401);
    expect(mocks.articleQuestionFindMany).not.toHaveBeenCalled();
  });
});
