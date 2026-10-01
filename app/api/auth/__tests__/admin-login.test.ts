// @vitest-environment node
/**
 * /api/auth/admin-login no padrão da Fase 8: os erros semânticos lançados
 * dentro do try mantêm o status e a mensagem de antes (400, 401, 429) e não
 * caem no 500 genérico nem são reportados ao Sentry como falha inesperada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { RateLimitError } from '@/lib/errors/api-error';

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockEnforceRateLimit = vi.fn();
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

const mockFindUnique = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => mockFindUnique(...a) } },
}));

const mockCompare = vi.fn();
vi.mock('bcryptjs', () => ({ default: { compare: (...a: unknown[]) => mockCompare(...a) } }));

vi.mock('@/lib/auth', () => ({ generateToken: vi.fn().mockResolvedValue('tok') }));
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ set: vi.fn() }) }));

const mockReportError = vi.fn();
vi.mock('@/lib/monitoring/report-error', () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
}));

import { POST } from '../admin-login/route';

function req(body: unknown) {
  return new NextRequest('http://localhost/api/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('/api/auth/admin-login: erros no padrão da Fase 8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  it('400 sem e-mail ou senha', async () => {
    const res = await POST(req({ email: 'a@b.com' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('E-mail e senha são obrigatórios');
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('401 com credenciais inválidas', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await POST(req({ email: 'a@b.com', password: 'x' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Credenciais inválidas');
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('429 com a mensagem própria do login', async () => {
    mockEnforceRateLimit.mockRejectedValue(new RateLimitError());
    const res = await POST(req({ email: 'a@b.com', password: 'x' }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/Muitas tentativas de login/);
  });

  it('500 genérico e reporte ao Sentry em falha inesperada', async () => {
    mockFindUnique.mockRejectedValue(new Error('banco fora do ar'));
    const res = await POST(req({ email: 'a@b.com', password: 'x' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Erro interno do servidor');
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), 'auth', { rota: 'admin-login' });
  });
});
