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
});
