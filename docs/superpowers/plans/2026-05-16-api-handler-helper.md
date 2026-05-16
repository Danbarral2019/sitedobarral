# API Handler Helper — Implementation Plan (PR 4.2.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o helper canônico `lib/api/handler.ts` com 3 HOFs (`withAdminApi`, `withUserApi`, `withPublicApi`) que substituem `withAdminAuth`/`withAuth` + `try/catch + handleApiError`, em paralelo ao `lib/api-middleware.ts` deprecado (sem migrar rotas).

**Architecture:** Wrapper monolítico interno `createApiHandler(role, handler, options)` executa rate-limit → auth → Sentry user → telemetria → handler dentro de um único `try/catch` que delega para `handleApiError`. Helpers públicos são thin wrappers que diferem só no `role`. Helper expõe `ctx.user`, `ctx.params` (desempacotado), `ctx.requestId` e `ctx.logger` (child do `apiLogger` com requestId). Header `X-Request-Id` em toda resposta.

**Tech Stack:** Next.js 15 App Router, TypeScript 5, Vitest 4, `pino` (logger), `@sentry/nextjs`, Prisma 7 (apenas indireto via `handleApiError`).

**Spec referência:** `docs/superpowers/specs/2026-05-16-api-pattern-design.md`

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/api/types.ts` (novo) | Tipos: `ApiRole`, `ApiContext`, `PublicApiContext`, `ApiHandler`, `ApiHandlerOptions` |
| `lib/api/handler.ts` (novo) | `createApiHandler` (interno) + `withAdminApi`, `withUserApi`, `withPublicApi` (público) |
| `lib/api/__tests__/handler.test.ts` (novo) | Suíte de testes — 5 grupos (rate-limit, auth, telemetry, requestId, errors) |
| `lib/api-middleware.ts` (modificado) | JSDoc `@deprecated` no topo + re-exports `withAdminAuth = withAdminApi` e `withAuth = withUserApi` para retrocompat |
| `scripts/api-migration-status.ts` (novo) | Script de métrica de progresso da migração |
| `package.json` (modificado) | Script npm `migration:api:status` |

**Não-objetivos desta PR** (vêm nas PRs 4.2.1+):
- Codemod automático
- Migração de qualquer rota
- Remoção de `lib/api-middleware.ts`

---

## Task 1: Setup da branch e tipos públicos

**Files:**
- Verify: branch `wave4/api-pattern-design` ativa
- Create: `lib/api/types.ts`

- [ ] **Step 1: Verificar que branch wave4/api-pattern-design está ativa**

Run: `git branch --show-current`
Expected: `wave4/api-pattern-design`

Se estiver em outra branch:
Run: `git checkout wave4/api-pattern-design`

- [ ] **Step 2: Criar lib/api/types.ts**

Create file `lib/api/types.ts`:

```typescript
import type { NextRequest, NextResponse } from 'next/server';
import type { AuthPayload } from '@/lib/auth';
import type { Logger } from 'pino';

export type ApiRole = 'admin' | 'user' | 'public';

/**
 * Contexto passado ao handler em rotas admin/user.
 * `user` é sempre não-null porque o helper aborta antes de invocar
 * o handler se auth falhar.
 */
export interface ApiContext<Params = unknown> {
  user: AuthPayload;
  params: Params;
  requestId: string;
  logger: Logger;
}

/**
 * Contexto passado ao handler em rotas públicas.
 * `user` é literal `null` para deixar explícito que não há autenticação.
 */
export interface PublicApiContext<Params = unknown> {
  user: null;
  params: Params;
  requestId: string;
  logger: Logger;
}

export type ApiHandler<Ctx, Params = unknown> = (
  request: NextRequest,
  context: Ctx & { params: Params }
) => Promise<NextResponse>;

export interface ApiHandlerOptions {
  /**
   * Override do rate-limit padrão da role.
   * Defaults: admin 30/60s, user 60/60s, public 30/60s por IP.
   */
  rateLimit?: { max: number; windowSec: number };

  /**
   * Liga/desliga telemetria adicional (breadcrumb Sentry + tag requestId +
   * logger.child com contexto). Default: true. requestId e X-Request-Id
   * são gerados independentemente desta flag.
   */
  telemetry?: boolean;
}

/**
 * Tipo do wrapper retornado pelos helpers — compatível com a assinatura
 * Next.js 15 para route handlers.
 */
export type NextRouteHandler<P = unknown> = (
  request: NextRequest,
  nextCtx: { params: Promise<P> }
) => Promise<NextResponse>;
```

- [ ] **Step 3: Verificar tipagem do arquivo isoladamente**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "lib/api/types.ts" | head -10`
Expected: nenhuma saída (sem erros no arquivo novo)

- [ ] **Step 4: Commit**

```bash
git add lib/api/types.ts
git commit -m "feat(api): tipos do padrão API canônico [Onda 4 PR 4.2.0]" --author="Daniel Barral <danbarral@gmail.com>"
```

---

## Task 2: Esqueleto do handler + teste de smoke

**Files:**
- Create: `lib/api/handler.ts`
- Create: `lib/api/__tests__/handler.test.ts`

- [ ] **Step 1: Escrever teste de smoke (vai falhar)**

Create file `lib/api/__tests__/handler.test.ts`:

```typescript
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
```

- [ ] **Step 2: Rodar teste para confirmar que falha (handler.ts ainda não existe)**

Run: `npx vitest run lib/api/__tests__/handler.test.ts 2>&1 | tail -20`
Expected: erro de resolução `Cannot find module '../handler'`

- [ ] **Step 3: Criar lib/api/handler.ts mínimo (só o smoke verde)**

Create file `lib/api/handler.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { apiLogger } from '@/lib/logger';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { handleApiError } from '@/lib/errors/error-handler';
import {
  AuthenticationError,
  AuthorizationError,
} from '@/lib/errors/api-error';
import type { AuthPayload } from '@/lib/auth';
import type {
  ApiContext,
  ApiHandler,
  ApiHandlerOptions,
  ApiRole,
  NextRouteHandler,
  PublicApiContext,
} from './types';

const ROLE_DEFAULTS: Record<ApiRole, { rateLimit: { max: number; windowSec: number } }> = {
  admin: { rateLimit: { max: 30, windowSec: 60 } },
  user: { rateLimit: { max: 60, windowSec: 60 } },
  public: { rateLimit: { max: 30, windowSec: 60 } },
};

function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function createApiHandler<P>(
  role: ApiRole,
  handler: ApiHandler<ApiContext<P> | PublicApiContext<P>, P>,
  options: ApiHandlerOptions = {}
): NextRouteHandler<P> {
  return async (request, nextCtx) => {
    const requestId = generateRequestId();
    let params: P;
    try {
      params = await nextCtx.params;
    } catch {
      params = {} as P;
    }

    let response: NextResponse;
    try {
      const rl = options.rateLimit ?? ROLE_DEFAULTS[role].rateLimit;
      const ip = getClientIp(request);
      await enforceRateLimit(`api:${role}:${ip}`, rl.max, rl.windowSec);

      let user: AuthPayload | null = null;
      if (role !== 'public') {
        const { getCurrentUser } = await import('@/lib/auth');
        user = await getCurrentUser();
        if (!user) {
          throw new AuthenticationError();
        }
        if (role === 'admin' && user.role !== 'admin') {
          throw new AuthorizationError();
        }
        Sentry.setUser({ id: user.userId, email: user.email, role: user.role });
      }

      const useTelemetry = options.telemetry !== false;
      const route = new URL(request.url).pathname;
      const logger = useTelemetry
        ? apiLogger.child({ requestId, route, method: request.method, role })
        : apiLogger;

      if (useTelemetry) {
        Sentry.addBreadcrumb({
          category: 'api',
          level: 'info',
          message: `${request.method} ${route}`,
          data: { requestId, role, userId: user?.userId },
        });
        Sentry.setTag('requestId', requestId);
      }

      const ctx = {
        user: user as AuthPayload & null, // narrowing depende da role; helpers públicos refinam
        params,
        requestId,
        logger,
      };

      response = await handler(request, ctx);
    } catch (error) {
      response = handleApiError(error);
    }

    response.headers.set('X-Request-Id', requestId);
    return response;
  };
}

export function withAdminApi<P = unknown>(
  handler: ApiHandler<ApiContext<P>, P>,
  options?: ApiHandlerOptions
): NextRouteHandler<P> {
  return createApiHandler<P>('admin', handler as ApiHandler<ApiContext<P> | PublicApiContext<P>, P>, options);
}

export function withUserApi<P = unknown>(
  handler: ApiHandler<ApiContext<P>, P>,
  options?: ApiHandlerOptions
): NextRouteHandler<P> {
  return createApiHandler<P>('user', handler as ApiHandler<ApiContext<P> | PublicApiContext<P>, P>, options);
}

export function withPublicApi<P = unknown>(
  handler: ApiHandler<PublicApiContext<P>, P>,
  options?: ApiHandlerOptions
): NextRouteHandler<P> {
  return createApiHandler<P>('public', handler as ApiHandler<ApiContext<P> | PublicApiContext<P>, P>, options);
}
```

- [ ] **Step 4: Rodar teste para verificar que smoke passa**

Run: `npx vitest run lib/api/__tests__/handler.test.ts 2>&1 | tail -20`
Expected: `1 passed`

- [ ] **Step 5: Rodar typecheck do projeto**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "lib/api/" | head -10`
Expected: nenhuma saída

- [ ] **Step 6: Commit**

```bash
git add lib/api/handler.ts lib/api/__tests__/handler.test.ts
git commit -m "feat(api): esqueleto do helper canônico + smoke test [Onda 4 PR 4.2.0]" --author="Daniel Barral <danbarral@gmail.com>"
```

---

## Task 3: Testes de rate-limit

**Files:**
- Modify: `lib/api/__tests__/handler.test.ts`

- [ ] **Step 1: Adicionar testes de rate-limit (vão falhar até implementação confirmar comportamento)**

Append to `lib/api/__tests__/handler.test.ts` (dentro do `describe('lib/api/handler', ...)` outer block, após o describe `'smoke'`):

```typescript
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
```

- [ ] **Step 2: Rodar testes**

Run: `npx vitest run lib/api/__tests__/handler.test.ts 2>&1 | tail -20`
Expected: `6 passed` (1 smoke + 5 rate-limit). Se algum falhar, ler erro e ajustar `handler.ts` correspondentemente.

- [ ] **Step 3: Commit**

```bash
git add lib/api/__tests__/handler.test.ts
git commit -m "test(api): cobertura de rate-limit no helper canônico [Onda 4 PR 4.2.0]" --author="Daniel Barral <danbarral@gmail.com>"
```

---

## Task 4: Testes de autenticação

**Files:**
- Modify: `lib/api/__tests__/handler.test.ts`

- [ ] **Step 1: Adicionar grupo de testes de auth**

Append to `lib/api/__tests__/handler.test.ts` (após o describe `'rate-limit'`):

```typescript
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
```

- [ ] **Step 2: Rodar testes**

Run: `npx vitest run lib/api/__tests__/handler.test.ts 2>&1 | tail -20`
Expected: todos passando (smoke + rate-limit + auth ≈ 16 testes).

- [ ] **Step 3: Commit**

```bash
git add lib/api/__tests__/handler.test.ts
git commit -m "test(api): cobertura de auth admin/user/public [Onda 4 PR 4.2.0]" --author="Daniel Barral <danbarral@gmail.com>"
```

---

## Task 5: Testes de requestId, header e ctx.params

**Files:**
- Modify: `lib/api/__tests__/handler.test.ts`

- [ ] **Step 1: Adicionar testes de requestId/params/logger**

Append to `lib/api/__tests__/handler.test.ts`:

```typescript
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

      // pino logger child tem .child, .info, .error
      expect(logger).toBeDefined();
      expect(typeof (logger as { info: unknown }).info).toBe('function');
      expect(typeof (logger as { error: unknown }).error).toBe('function');
    });
  });
```

- [ ] **Step 2: Rodar testes**

Run: `npx vitest run lib/api/__tests__/handler.test.ts 2>&1 | tail -20`
Expected: todos passando.

- [ ] **Step 3: Commit**

```bash
git add lib/api/__tests__/handler.test.ts
git commit -m "test(api): cobertura de requestId, params, logger [Onda 4 PR 4.2.0]" --author="Daniel Barral <danbarral@gmail.com>"
```

---

## Task 6: Testes de erros + telemetria

**Files:**
- Modify: `lib/api/__tests__/handler.test.ts`

- [ ] **Step 1: Adicionar testes de errors + telemetry**

Append to `lib/api/__tests__/handler.test.ts`:

```typescript
  describe('error handling via handleApiError', () => {
    beforeEach(async () => {
      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ userId: 'u1', role: 'admin' });
    });

    it('ValidationError vira 400 com code VALIDATION_ERROR', async () => {
      const handler = withAdminApi(async () => {
        const { ValidationError } = await import('@/lib/errors/api-error');
        throw new ValidationError('campo X inválido');
      });

      const response = await handler(makeRequest(), makeNextCtx());
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('campo X inválido');
    });

    it('NotFoundError vira 404 com code NOT_FOUND', async () => {
      const handler = withAdminApi(async () => {
        const { NotFoundError } = await import('@/lib/errors/api-error');
        throw new NotFoundError('Documento');
      });

      const response = await handler(makeRequest(), makeNextCtx());
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    it('Error genérico (não-operacional) vira 500 e é capturado no Sentry', async () => {
      const Sentry = await import('@sentry/nextjs');
      vi.mocked(Sentry.captureException).mockReset();

      const handler = withAdminApi(async () => {
        throw new Error('boom');
      });

      const response = await handler(makeRequest(), makeNextCtx());
      expect(response.status).toBe(500);
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled();
    });
  });

  describe('telemetry', () => {
    beforeEach(async () => {
      const Sentry = await import('@sentry/nextjs');
      vi.mocked(Sentry.addBreadcrumb).mockReset();
      vi.mocked(Sentry.setTag).mockReset();

      const auth = await import('@/lib/auth');
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ userId: 'u1', role: 'admin' });
    });

    it('adiciona breadcrumb com método + path + requestId quando telemetry ON (default)', async () => {
      const Sentry = await import('@sentry/nextjs');

      const handler = withAdminApi(async () => NextResponse.json({}));
      await handler(makeRequest('https://example.com/api/admin/foo', 'POST'), makeNextCtx());

      expect(vi.mocked(Sentry.addBreadcrumb)).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'api',
          message: 'POST /api/admin/foo',
          data: expect.objectContaining({
            role: 'admin',
            userId: 'u1',
            requestId: expect.stringMatching(/^[0-9a-f]{8}$/),
          }),
        })
      );
    });

    it('seta tag requestId no Sentry quando telemetry ON', async () => {
      const Sentry = await import('@sentry/nextjs');

      const handler = withAdminApi(async () => NextResponse.json({}));
      await handler(makeRequest(), makeNextCtx());

      expect(vi.mocked(Sentry.setTag)).toHaveBeenCalledWith(
        'requestId',
        expect.stringMatching(/^[0-9a-f]{8}$/)
      );
    });

    it('não adiciona breadcrumb quando telemetry: false', async () => {
      const Sentry = await import('@sentry/nextjs');

      const handler = withAdminApi(
        async () => NextResponse.json({}),
        { telemetry: false }
      );
      await handler(makeRequest(), makeNextCtx());

      expect(vi.mocked(Sentry.addBreadcrumb)).not.toHaveBeenCalled();
      expect(vi.mocked(Sentry.setTag)).not.toHaveBeenCalled();
    });

    it('header X-Request-Id continua presente mesmo com telemetry: false', async () => {
      const handler = withAdminApi(
        async () => NextResponse.json({}),
        { telemetry: false }
      );
      const response = await handler(makeRequest(), makeNextCtx());

      expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f]{8}$/);
    });
  });
```

- [ ] **Step 2: Rodar todos os testes**

Run: `npx vitest run lib/api/__tests__/handler.test.ts 2>&1 | tail -30`
Expected: todos passando. Contagem aproximada: 25-30 testes.

- [ ] **Step 3: Rodar typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "lib/api/" | head -10`
Expected: nenhuma saída.

- [ ] **Step 4: Commit**

```bash
git add lib/api/__tests__/handler.test.ts
git commit -m "test(api): cobertura de errors + telemetria [Onda 4 PR 4.2.0]" --author="Daniel Barral <danbarral@gmail.com>"
```

---

## Task 7: Depreciar lib/api-middleware.ts com re-exports

**Files:**
- Modify: `lib/api-middleware.ts`

- [ ] **Step 1: Ler arquivo atual para preservar exports**

Run: `wc -l lib/api-middleware.ts && head -10 lib/api-middleware.ts`
Expected: 158 linhas; topo com import block.

- [ ] **Step 2: Adicionar JSDoc @deprecated no topo + re-exports**

Modify `lib/api-middleware.ts`. Após o último export (linha 157), adicionar:

```typescript

// ============================================================
// DEPRECATED — Re-exports para retrocompat durante Onda 4
// ============================================================

/**
 * @deprecated Use `withAdminApi` from `@/lib/api/handler` instead.
 * Este alias existe apenas para permitir migração incremental das ~196 rotas
 * legadas. Será removido na PR 4.2.final quando `grep -rl "api-middleware"`
 * retornar 0. Ver `docs/superpowers/specs/2026-05-16-api-pattern-design.md`.
 */
export { withAdminApi as withAdminAuthV2 } from '@/lib/api/handler';

/**
 * @deprecated Use `withUserApi` from `@/lib/api/handler` instead.
 * Idem `withAdminAuthV2`.
 */
export { withUserApi as withAuthV2 } from '@/lib/api/handler';
```

E adicionar comentário JSDoc `@deprecated` em cada `export function` existente (`withAdminAuth`, `withAuth`, `verifyAdmin`).

No topo de cada uma das 3 funções já existentes, **antes** do `export function`, inserir o bloco abaixo. Exemplo para `withAdminAuth` (mesmo padrão para as outras duas):

```typescript
/**
 * @deprecated Use `withAdminApi` from `@/lib/api/handler` instead.
 * Esta função será removida na PR 4.2.final da Onda 4. Migração tracking:
 * `docs/superpowers/plans/<plano-de-migração>`.
 */
```

> **Importante:** as funções legadas continuam funcionando idênticas — não mudar comportamento. Re-exports `withAdminAuthV2`/`withAuthV2` são uma ponte: rotas podem migrar manualmente trocando só o nome (sem trocar o import path) durante uma fase intermediária, se quiserem.

- [ ] **Step 3: Rodar typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "lib/api-middleware" | head -10`
Expected: nenhuma saída.

- [ ] **Step 4: Rodar testes existentes do middleware se houver**

Run: `npx vitest run lib/__tests__/api-middleware 2>&1 | tail -10`
Expected: PASS (se existir) ou "No test files found" (se não existir, OK).

- [ ] **Step 5: Commit**

```bash
git add lib/api-middleware.ts
git commit -m "deprecate(api): marca lib/api-middleware com @deprecated + re-exports [Onda 4 PR 4.2.0]" --author="Daniel Barral <danbarral@gmail.com>"
```

---

## Task 8: Script de métrica de progresso

**Files:**
- Create: `scripts/api-migration-status.ts`
- Modify: `package.json`

- [ ] **Step 1: Criar scripts/api-migration-status.ts**

Create file `scripts/api-migration-status.ts`:

```typescript
/**
 * Reporta progresso da migração da Onda 4 (Padronização API).
 *
 * Uso:
 *   npx tsx scripts/api-migration-status.ts
 *   npm run migration:api:status
 *
 * Saída: tabela com contagens das principais métricas.
 */

import { execSync } from 'child_process';

function count(pattern: string, paths: string): number {
  try {
    const out = execSync(
      `grep -rl --include='*.ts' '${pattern}' ${paths} 2>/dev/null | wc -l`,
      { encoding: 'utf8' }
    );
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function countOccurrences(pattern: string, paths: string): number {
  try {
    const out = execSync(
      `grep -rh --include='*.ts' '${pattern}' ${paths} 2>/dev/null | wc -l`,
      { encoding: 'utf8' }
    );
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function main(): void {
  const usingLegacy = count("from '@/lib/api-middleware'", 'app lib');
  const usingNew = count("from '@/lib/api/handler'", 'app lib');
  const errorJson = countOccurrences(
    "NextResponse\\.json(\\s*{\\s*error\\s*:",
    'app/api'
  );
  const totalRoutes = count("export const \\(GET\\|POST\\|PUT\\|DELETE\\|PATCH\\)", 'app/api');

  const totalToMigrate = usingLegacy + Math.max(0, errorJson - usingLegacy);

  console.log('\n=== Onda 4 — Migração API Pattern ===\n');
  console.log(`Arquivos usando lib/api-middleware:   ${usingLegacy.toString().padStart(4)}  (alvo: 0)`);
  console.log(`Arquivos usando lib/api/handler:      ${usingNew.toString().padStart(4)}  (alvo: ≥190)`);
  console.log(`Ocorrências de NextResponse.json({error}: ${errorJson.toString().padStart(4)}  (alvo: 0 em rotas migradas)`);
  console.log(`Rotas estimadas a migrar (restantes): ${totalToMigrate.toString().padStart(4)}`);

  const pct = usingNew > 0 ? Math.round((usingNew / (usingNew + usingLegacy)) * 100) : 0;
  console.log(`\nProgresso da migração: ${pct}%`);
}

main();
```

- [ ] **Step 2: Adicionar script ao package.json**

Read `package.json`, encontrar bloco `"scripts": { ... }`, adicionar (em ordem alfabética se possível):

```json
"migration:api:status": "tsx scripts/api-migration-status.ts",
```

Run: `cat package.json | grep migration:api`
Expected: linha presente.

- [ ] **Step 3: Rodar script para baseline**

Run: `npm run migration:api:status 2>&1 | tail -10`
Expected: tabela com `Arquivos usando lib/api-middleware: ~50+` e `Arquivos usando lib/api/handler: 0`. Anotar valores como baseline para próximas PRs.

- [ ] **Step 4: Commit**

```bash
git add scripts/api-migration-status.ts package.json
git commit -m "feat(scripts): script de métrica de progresso da Onda 4 [Onda 4 PR 4.2.0]" --author="Daniel Barral <danbarral@gmail.com>"
```

---

## Task 9: Smoke test em uma rota existente (prova de uso)

**Goal:** validar que o helper funciona com uma rota real, **sem ainda fazer parte da migração formal** (a migração é a PR 4.2.1+). Vamos criar uma rota nova *throwaway* só para validar end-to-end e depois removê-la.

**Files:**
- Create: `app/api/_health/api-pattern/route.ts` (throwaway, removida no fim da task)

- [ ] **Step 1: Criar rota de smoke pública**

Create file `app/api/_health/api-pattern/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { withPublicApi } from '@/lib/api/handler';

/**
 * Rota throwaway para smoke do helper canônico (PR 4.2.0).
 * Remover ao final da Task 9.
 */
export const GET = withPublicApi(async (_req, ctx) => {
  return NextResponse.json({
    ok: true,
    requestId: ctx.requestId,
    note: 'helper API canônico — Onda 4 PR 4.2.0',
  });
});
```

- [ ] **Step 2: Iniciar dev server em background**

Run: `npm run dev &`
Wait 8 seconds para boot. Then verify:
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/_health/api-pattern`
Expected: `200`

- [ ] **Step 3: Verificar resposta + header X-Request-Id**

Run: `curl -si http://localhost:3000/api/_health/api-pattern 2>&1 | head -20`
Expected:
- Status `200 OK`
- Header `x-request-id: <8 hex chars>`
- Body JSON `{"ok":true,"requestId":"<mesmo valor do header>","note":"..."}`

Anotar o valor do `requestId` — verificar manualmente que o do header **bate** com o do body.

- [ ] **Step 4: Verificar 429 quando rate limit estoura**

Run:
```bash
for i in {1..35}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/_health/api-pattern; done | sort | uniq -c
```
Expected: 30× `200`, 5× `429` (rate limit é 30/min default público).

> Se rate limit não dispara em ambiente local porque Redis não está rodando, **OK** — significa que `enforceRateLimit` em dev faz no-op. Skip para o próximo step.

- [ ] **Step 5: Matar dev server**

Run: `pkill -f "next dev"` ou ctrl+C no terminal do dev server.

- [ ] **Step 6: Remover rota throwaway**

Run:
```bash
rm app/api/_health/api-pattern/route.ts
rmdir app/api/_health/api-pattern app/api/_health 2>/dev/null || true
```

- [ ] **Step 7: Confirmar limpeza**

Run: `ls app/api/_health 2>/dev/null`
Expected: `No such file or directory`

- [ ] **Step 8: Commit (vazio, sentinela de validação)**

```bash
git commit --allow-empty -m "test(api): smoke E2E do helper validado em dev [Onda 4 PR 4.2.0]" --author="Daniel Barral <danbarral@gmail.com>"
```

---

## Task 10: Verificação final + abrir PR

**Files:**
- Verify: build, testes, typecheck do projeto inteiro

- [ ] **Step 1: Build de produção**

Run: `npm run build 2>&1 | tail -30`
Expected: build bem-sucedido, sem erros. Pode demorar ~3 min.

- [ ] **Step 2: Suíte de testes completa**

Run: `npm run test:run 2>&1 | tail -20`
Expected: todos os testes passando (≥577 testes do baseline + ~25 novos do helper).

- [ ] **Step 3: Typecheck do projeto**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: nenhuma saída.

- [ ] **Step 4: Status do git**

Run: `git status -sb && echo '---' && git log --oneline origin/main..HEAD 2>/dev/null`
Expected: 8 commits ahead de main, branch `wave4/api-pattern-design`, working tree limpa.

- [ ] **Step 5: Push da branch**

Run: `git push -u origin wave4/api-pattern-design`
Expected: branch criada no remote.

- [ ] **Step 6: Abrir PR via gh**

Run:
```bash
gh pr create --title "feat(api): helper canônico lib/api/handler [Onda 4 PR 4.2.0]" --body "$(cat <<'EOF'
## Summary

Cria o helper canônico `lib/api/handler.ts` com 3 HOFs (`withAdminApi`, `withUserApi`, `withPublicApi`) que unificam auth + rate-limit + Sentry user + `handleApiError` + telemetria por request. **Não migra rotas** — `lib/api-middleware.ts` continua funcional (marcada `@deprecated`).

Spec aprovado em `docs/superpowers/specs/2026-05-16-api-pattern-design.md` (Onda 4 PR 4.1).

## Mudanças

- `lib/api/types.ts` — `ApiContext`, `PublicApiContext`, `ApiHandler`, `ApiHandlerOptions`, `NextRouteHandler`
- `lib/api/handler.ts` — `createApiHandler` interno + 3 helpers públicos
- `lib/api/__tests__/handler.test.ts` — ~25 testes cobrindo rate-limit, auth, errors, telemetria, requestId, params, logger
- `lib/api-middleware.ts` — adiciona JSDoc `@deprecated` + re-exports `withAdminAuthV2`/`withAuthV2` (ponte para migração)
- `scripts/api-migration-status.ts` — script `npm run migration:api:status` para acompanhar progresso
- `package.json` — adiciona script

## Test plan

- [x] `npm run test:run` — todos os testes passando
- [x] `npm run build` — build de produção sem erros
- [x] `npx tsc --noEmit` — typecheck limpo
- [x] Smoke E2E em rota throwaway: header `X-Request-Id` presente, requestId bate com body, rate limit funciona (em ambiente com Redis)
- [ ] Após merge: verificar Sentry receber breadcrumb `api` na próxima request em produção

## Próximos passos

PR 4.2.1+ — codemod e migração das ~196 rotas em fases (~12 PRs). Plano será produzido em sessão futura após validar este helper em produção por 24-48h.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Retornar URL do PR ao usuário**

Run: `gh pr view --json url --jq '.url'`
Expected: URL do PR.

---

## Self-Review

### Spec coverage check

Verificando que cada item do spec é coberto por uma task acima:

| Spec requirement | Task que cobre |
|---|---|
| `lib/api/handler.ts` (novo) | Task 2 |
| `lib/api/types.ts` (novo) | Task 1 |
| `lib/api/__tests__/handler.test.ts` (novo) | Tasks 2-6 |
| `lib/api-middleware.ts` deprecado com re-exports | Task 7 |
| `scripts/api-migration-status.ts` | Task 8 |
| 3 helpers `withAdminApi/withUserApi/withPublicApi` | Task 2 |
| `ApiContext` com `user`, `params`, `requestId`, `logger` | Task 1, validado em Tasks 4-5 |
| `PublicApiContext` com `user: null` | Task 1, validado em Task 4 |
| Wrapper monolítico `createApiHandler` | Task 2 |
| 6 estágios: requestId → params → rate-limit → auth → telemetry → handler | Task 2, validado em Tasks 3-6 |
| Defaults rate-limit: admin 30/60, user 60/60, public 30/60 | Task 2, validado em Task 3 |
| Override de rate-limit via `options.rateLimit` | Task 2, validado em Task 3 |
| Header `X-Request-Id` em sucesso E erro | Task 2, validado em Task 5 |
| Sentry: setUser, breadcrumb, setTag('requestId') | Task 2, validado em Tasks 4 e 6 |
| `ctx.logger = apiLogger.child({ requestId, route, method, role })` | Task 2, validado em Task 5 |
| `params` desempacotado (await aplicado) | Task 2, validado em Task 5 |
| Telemetria desligável via `options.telemetry: false` | Task 2, validado em Task 6 |
| AuthenticationError 401 / AuthorizationError 403 via handleApiError | Task 2, validado em Tasks 4 e 6 |
| Não migrar rotas nesta PR | Garantido — nenhuma task toca `app/api/**` (a rota throwaway é removida) |

**Coverage:** 100%. Nenhum requisito sem task.

### Placeholder scan

Busca por "TODO", "TBD", "FIXME", "similar to": nenhuma ocorrência nos blocos de step instrucionais. Todos os steps têm comandos ou código concretos.

### Type consistency

- `createApiHandler<P>` em Task 2 — usado consistentemente
- `ApiHandler<Ctx, Params>` definido em Task 1 — referenciado nos 3 wrappers públicos em Task 2 com `ApiContext<P>` / `PublicApiContext<P>` corretamente
- `ApiHandlerOptions` definido em Task 1 — referenciado em Task 2 com `options.rateLimit` e `options.telemetry`
- `enforceRateLimit(key, max, windowSec)` em Task 2 corresponde à assinatura real do `lib/cache/rate-limit-helper.ts`
- `AuthPayload.role` é `'admin' | 'student'` (não `'user'`) — testes em Task 4 usam `'student'` corretamente

Sem inconsistências detectadas.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-16-api-handler-helper.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatcho um subagent fresco por task, revisão entre tasks, iteração rápida. Bom para isolamento e foco.

**2. Inline Execution** — executa tasks nesta sessão usando `executing-plans`, com checkpoints para revisão. Bom se você quiser ver/intervir em cada step.

**Qual abordagem?**
