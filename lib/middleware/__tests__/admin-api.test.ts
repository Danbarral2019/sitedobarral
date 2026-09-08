// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const jwtVerify = vi.hoisted(() => vi.fn());

vi.mock('jose', () => ({ jwtVerify }));
vi.mock('@/lib/logger', () => ({
  authLogger: { debug: vi.fn() },
}));

import { middleware } from '../../../middleware';

function makeRequest(token?: string): NextRequest {
  const request = new NextRequest('http://localhost/api/admin/depoimentos');
  if (token) request.cookies.set('auth-token', token);
  return request;
}

describe('proteção de /api/admin no middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('COMING_SOON_ENABLED', 'false');
    vi.stubEnv('JWT_SECRET', 'test-secret-key-for-jwt-signing-minimum-32-chars');
  });

  it('retorna JSON 401 sem token', async () => {
    const response = await middleware(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Não autenticado' });
  });

  it('retorna JSON 403 para usuário não administrador', async () => {
    jwtVerify.mockResolvedValue({ payload: { userId: 'student-1', role: 'student' } });

    const response = await middleware(makeRequest('student-token'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Acesso negado' });
  });

  it('retorna JSON 401 para token inválido ou expirado', async () => {
    jwtVerify.mockRejectedValue(new Error('token inválido'));

    const response = await middleware(makeRequest('invalid-token'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Não autenticado' });
  });

  it('permite administrador autenticado', async () => {
    jwtVerify.mockResolvedValue({ payload: { userId: 'admin-1', role: 'admin' } });

    const response = await middleware(makeRequest('admin-token'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
