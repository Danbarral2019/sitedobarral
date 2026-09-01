// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  enforceGlobalAiCap: vi.fn(),
  queryGeminiText: vi.fn(),
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
vi.mock('@/lib/gemini/config', () => ({ PRIMARY_GEMINI_MODEL: 'gemini-test' }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/data/lei-14133-artigos', () => ({ LEI_14133_ARTIGOS: {} }));
vi.mock('@/data/enunciados', () => ({ ENUNCIADOS: [], buscarEnunciados: () => [] }));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from '../route';

function makeRequest(query: unknown): NextRequest {
  return new NextRequest('http://localhost/api/lei-14133/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
}

describe('/api/lei-14133/search validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.enforceGlobalAiCap.mockResolvedValue({ action: 'allow' });
  });

  it('rejeita consulta acima de 300 caracteres sem chamar IA', async () => {
    const response = await POST(makeRequest('a'.repeat(301)));

    expect(response.status).toBe(400);
    expect(mocks.enforceGlobalAiCap).not.toHaveBeenCalled();
    expect(mocks.queryGeminiText).not.toHaveBeenCalled();
  });
});
