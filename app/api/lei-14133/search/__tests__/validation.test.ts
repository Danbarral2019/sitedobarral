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
vi.mock('@/lib/logger', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => logger };
  return { apiLogger: logger };
});
const authState = vi.hoisted(() => ({
  user: { userId: 'user-1', email: 'aluno@x.com', role: 'student' } as
    | { userId: string; email: string; role: string }
    | null,
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => authState.user }));

import { POST } from '../route';

const routeCtx = { params: Promise.resolve({}) };

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

  it('exige login: visitante recebe 401 sem rate-limit da busca nem IA', async () => {
    authState.user = null;
    try {
      const response = await POST(makeRequest('dispensa de licitação'), routeCtx);

      expect(response.status).toBe(401);
      expect(mocks.enforceGlobalAiCap).not.toHaveBeenCalled();
      expect(mocks.queryGeminiText).not.toHaveBeenCalled();
    } finally {
      authState.user = { userId: 'user-1', email: 'aluno@x.com', role: 'student' };
    }
  });

  it('rejeita consulta acima de 300 caracteres sem chamar IA', async () => {
    const response = await POST(makeRequest('a'.repeat(301)), routeCtx);

    expect(response.status).toBe(400);
    expect(mocks.enforceGlobalAiCap).not.toHaveBeenCalled();
    expect(mocks.queryGeminiText).not.toHaveBeenCalled();
  });
});
