// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnforceRateLimit, mockEnforceGlobalAiCap, mockQueryGeminiText } = vi.hoisted(() => ({
  mockEnforceRateLimit: vi.fn(),
  mockEnforceGlobalAiCap: vi.fn(),
  mockQueryGeminiText: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  getClientIp: () => '127.0.0.1',
}));

vi.mock('@/lib/cache/ai-quota', () => ({
  enforceGlobalAiCap: (...args: unknown[]) => mockEnforceGlobalAiCap(...args),
}));

vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: unknown[]) => mockQueryGeminiText(...args),
}));

vi.mock('@/lib/gemini/config', () => ({
  PRIMARY_GEMINI_MODEL: 'gemini-test',
  PREMIUM_GEMINI_MODEL: 'gemini-premium-test',
  isPremiumChatQuery: () => false,
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/data/lei-14133-artigos', () => ({ LEI_14133_ARTIGOS: {} }));
vi.mock('@/data/lei-14133-cross-references', () => ({ findRelatedArticles: () => [] }));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/artigos/75/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const routeCtx = { params: Promise.resolve({ numero: '75' }) };

describe('/api/artigos/[numero]/chat — kill-switch global', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockEnforceGlobalAiCap.mockResolvedValue({ action: 'allow' });
  });

  it('degrade-search → não chama o Gemini e responde com mensagem de alta demanda', async () => {
    mockEnforceGlobalAiCap.mockResolvedValue({ action: 'degrade-search', reason: 'global' });

    const res = await POST(makeReq({ question: 'O que diz este artigo?' }), routeCtx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockQueryGeminiText).not.toHaveBeenCalled();
    expect(body.answer).toMatch(/alta demanda/i);
    expect(body.degraded).toBe(true);
  });
});
