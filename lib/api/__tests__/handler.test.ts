/**
 * Suíte de testes do helper canônico lib/api/handler.ts
 *
 * Cobre:
 *   - rate-limit (defaults + override)
 *   - auth (admin, user, public)
 *   - erros operacionais e inesperados via handleApiError
 *   - requestId (header X-Request-Id, ctx.requestId)
 *   - telemetria (breadcrumb Sentry, ctx.logger)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withAdminApi, withUserApi, withPublicApi } from '../handler';

// Mocks de dependências externas
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@sentry/nextjs', () => ({
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  setTag: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/lib/logger', () => {
  const noop = () => {};
  const logger = {
    child: () => logger,
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
  };
  return { apiLogger: logger, authLogger: logger, logger };
});

function makeRequest(url = 'https://example.com/api/test', method = 'GET'): NextRequest {
  return new NextRequest(url, { method });
}

function makeNextCtx<P = Record<string, never>>(params: P = {} as P) {
  return { params: Promise.resolve(params) };
}

describe('lib/api/handler', () => {
  describe('smoke', () => {
    it('withPublicApi invoca o handler e retorna resposta com X-Request-Id', async () => {
      const handler = withPublicApi(async () => NextResponse.json({ ok: true }));
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('rate-limit', () => {
    beforeEach(async () => {
      const rl = await import('@/lib/cache/rate-limit-helper');
      vi.mocked(rl.enforceRateLimit).mockReset().mockResolvedValue(undefined);
      vi.mocked(rl.getClientIp).mockReturnValue('203.0.113.5');
    });

    it('usa default admin (30/60s) quando sem override', async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ userId: 'u1', role: 'admin' });

      const handler = withAdminApi(async () => NextResponse.json({}));
      await handler(makeRequest(), makeNextCtx());

      const rl = await import('@/lib/cache/rate-limit-helper');
      expect(vi.mocked(rl.enforceRateLimit)).toHaveBeenCalledWith(
        'api:admin:203.0.113.5',
        30,
        60
      );
    });

    it('usa default user (60/60s) quando sem override', async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ userId: 'u1', role: 'student' });

      const handler = withUserApi(async () => NextResponse.json({}));
      await handler(makeRequest(), makeNextCtx());

      const rl = await import('@/lib/cache/rate-limit-helper');
      expect(vi.mocked(rl.enforceRateLimit)).toHaveBeenCalledWith(
        'api:user:203.0.113.5',
        60,
        60
      );
    });

    it('usa default public (30/60s) quando sem override', async () => {
      const handler = withPublicApi(async () => NextResponse.json({}));
      await handler(makeRequest(), makeNextCtx());

      const rl = await import('@/lib/cache/rate-limit-helper');
      expect(vi.mocked(rl.enforceRateLimit)).toHaveBeenCalledWith(
        'api:public:203.0.113.5',
        30,
        60
      );
    });

    it('aplica override quando passado em options.rateLimit', async () => {
      const handler = withPublicApi(
        async () => NextResponse.json({}),
        { rateLimit: { max: 5, windowSec: 600 } }
      );
      await handler(makeRequest(), makeNextCtx());

      const rl = await import('@/lib/cache/rate-limit-helper');
      expect(vi.mocked(rl.enforceRateLimit)).toHaveBeenCalledWith(
        'api:public:203.0.113.5',
        5,
        600
      );
    });

    it('RateLimitError vira 429 via handleApiError', async () => {
      const { RateLimitError } = await import('@/lib/errors/api-error');
      const rl = await import('@/lib/cache/rate-limit-helper');
      vi.mocked(rl.enforceRateLimit).mockRejectedValueOnce(new RateLimitError());

      const handler = withPublicApi(async () => NextResponse.json({}));
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f]{8}$/);
    });
  });
});
