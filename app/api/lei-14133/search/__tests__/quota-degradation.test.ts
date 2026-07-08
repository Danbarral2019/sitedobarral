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

vi.mock('@/lib/gemini/config', () => ({ PRIMARY_GEMINI_MODEL: 'gemini-test' }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/lei-14133/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/lei-14133/search — kill-switch global', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(undefined);
    mockEnforceGlobalAiCap.mockResolvedValue({ action: 'allow' });
    mockQueryGeminiText.mockResolvedValue({ response: '{"summary":"s","articles":[]}', cached: false });
  });

  it('degrade-search → não chama o Gemini e retorna isAISearch=false', async () => {
    mockEnforceGlobalAiCap.mockResolvedValue({ action: 'degrade-search', reason: 'global' });

    const res = await POST(makeReq({ query: 'dispensa de licitação' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockQueryGeminiText).not.toHaveBeenCalled();
    expect(body.isAISearch).toBe(false);
    expect(body.summary).toMatch(/alta demanda/i);
  });

  it('allow → sintetiza normalmente (Gemini chamado)', async () => {
    await POST(makeReq({ query: 'dispensa de licitação' }));
    expect(mockQueryGeminiText).toHaveBeenCalledTimes(1);
  });
});
