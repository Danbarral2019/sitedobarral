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

  describe('auth — withAdminApi', () => {
    beforeEach(async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockReset();
    });

    it('responde 401 quando getCurrentUser retorna null', async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue(null);
      const handlerFn = vi.fn();

      const handler = withAdminApi(handlerFn);
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.status).toBe(401);
      expect(handlerFn).not.toHaveBeenCalled();
    });

    it('responde 403 quando user.role !== "admin"', async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ userId: 'u1', role: 'student' });
      const handlerFn = vi.fn();

      const handler = withAdminApi(handlerFn);
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.status).toBe(403);
      expect(handlerFn).not.toHaveBeenCalled();
    });

    it('invoca handler com ctx.user populado quando user é admin', async () => {
      const auth = await import('@/lib/auth');
      const adminUser = { userId: 'admin-1', role: 'admin' as const, email: 'a@b.com' };
      vi.mocked(auth.getCurrentUser).mockResolvedValue(adminUser);

      const handler = withAdminApi(async (_req, ctx) => {
        expect(ctx.user).toEqual(adminUser);
        return NextResponse.json({ userId: ctx.user.userId });
      });

      const response = await handler(makeRequest(), makeNextCtx());
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.userId).toBe('admin-1');
    });

    it('chama Sentry.setUser com dados do admin', async () => {
      const Sentry = await import('@sentry/nextjs');
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue({
        userId: 'admin-1',
        role: 'admin',
        email: 'a@b.com',
      });

      const handler = withAdminApi(async () => NextResponse.json({}));
      await handler(makeRequest(), makeNextCtx());

      expect(vi.mocked(Sentry.setUser)).toHaveBeenCalledWith({
        id: 'admin-1',
        email: 'a@b.com',
        role: 'admin',
      });
    });
  });

  describe('auth — withUserApi', () => {
    beforeEach(async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockReset();
    });

    it('responde 401 quando user é null', async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue(null);

      const handler = withUserApi(async () => NextResponse.json({}));
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.status).toBe(401);
    });

    it('aceita user com role "student"', async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ userId: 's-1', role: 'student' });

      const handler = withUserApi(async (_req, ctx) => NextResponse.json({ id: ctx.user.userId }));
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('s-1');
    });

    it('aceita user com role "admin"', async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ userId: 'a-1', role: 'admin' });

      const handler = withUserApi(async () => NextResponse.json({}));
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.status).toBe(200);
    });
  });

  describe('auth — withPublicApi', () => {
    it('não chama getCurrentUser', async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockReset();

      const handler = withPublicApi(async () => NextResponse.json({}));
      await handler(makeRequest(), makeNextCtx());

      expect(vi.mocked(auth.getCurrentUser)).not.toHaveBeenCalled();
    });

    it('passa ctx.user como null para o handler', async () => {
      const handler = withPublicApi(async (_req, ctx) => {
        expect(ctx.user).toBeNull();
        return NextResponse.json({ ok: true });
      });
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.status).toBe(200);
    });

    it('não chama Sentry.setUser', async () => {
      const Sentry = await import('@sentry/nextjs');
      vi.mocked(Sentry.setUser).mockReset();

      const handler = withPublicApi(async () => NextResponse.json({}));
      await handler(makeRequest(), makeNextCtx());

      expect(vi.mocked(Sentry.setUser)).not.toHaveBeenCalled();
    });
  });

  describe('requestId + header X-Request-Id', () => {
    it('gera requestId de 8 chars hex e expõe em ctx.requestId', async () => {
      let captured: string | undefined;
      const handler = withPublicApi(async (_req, ctx) => {
        captured = ctx.requestId;
        return NextResponse.json({});
      });

      await handler(makeRequest(), makeNextCtx());
      expect(captured).toMatch(/^[0-9a-f]{8}$/);
    });

    it('inclui X-Request-Id no header de resposta com sucesso', async () => {
      const handler = withPublicApi(async () => NextResponse.json({ ok: true }));
      const response = await handler(makeRequest(), makeNextCtx());

      const headerValue = response.headers.get('X-Request-Id');
      expect(headerValue).toMatch(/^[0-9a-f]{8}$/);
    });

    it('inclui X-Request-Id no header de resposta de erro', async () => {
      const handler = withPublicApi(async () => {
        const { NotFoundError } = await import('@/lib/errors/api-error');
        throw new NotFoundError('Recurso');
      });
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.status).toBe(404);
      expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f]{8}$/);
    });

    it('ctx.requestId é o mesmo valor que vai no header', async () => {
      let ctxId: string | undefined;
      const handler = withPublicApi(async (_req, ctx) => {
        ctxId = ctx.requestId;
        return NextResponse.json({});
      });

      const response = await handler(makeRequest(), makeNextCtx());
      expect(response.headers.get('X-Request-Id')).toBe(ctxId);
    });
  });

  describe('ctx.params (desempacotado)', () => {
    it('aplica await em nextCtx.params e passa resolvido ao handler', async () => {
      const handler = withPublicApi<{ id: string }>(async (_req, ctx) => {
        expect(ctx.params.id).toBe('abc');
        return NextResponse.json({ id: ctx.params.id });
      });

      const response = await handler(makeRequest(), { params: Promise.resolve({ id: 'abc' }) });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('abc');
    });

    it('passa objeto vazio quando params resolve para undefined', async () => {
      const handler = withPublicApi(async (_req, ctx) => {
        expect(ctx.params).toBeDefined();
        return NextResponse.json({});
      });

      const response = await handler(makeRequest(), makeNextCtx());
      expect(response.status).toBe(200);
    });
  });

  describe('ctx.logger', () => {
    it('expõe um logger child com requestId e route', async () => {
      let logger: unknown;
      const handler = withPublicApi(async (_req, ctx) => {
        logger = ctx.logger;
        return NextResponse.json({});
      });

      await handler(makeRequest('https://example.com/api/foo', 'POST'), makeNextCtx());

      expect(logger).toBeDefined();
      expect(typeof (logger as { info: unknown }).info).toBe('function');
      expect(typeof (logger as { error: unknown }).error).toBe('function');
    });
  });
});
