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
  handler: ApiHandler<ApiContext<P> | PublicApiContext<P>>,
  options: ApiHandlerOptions = {}
): NextRouteHandler<P> {
  return async (request, nextCtx) => {
    const requestId = generateRequestId();
    let response: NextResponse;

    try {
      const params = await nextCtx.params;

      // Rate-limit key intencionalmente sem route — replica o comportamento
      // do `lib/api-middleware.ts` antigo. Granularidade por-rota será revisitada
      // após a Onda 4 (mudança de comportamento, não cabe nesta PR).
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

      const ctx: ApiContext<P> | PublicApiContext<P> =
        role === 'public'
          ? ({ user: null, params, requestId, logger } satisfies PublicApiContext<P>)
          : ({ user: user as AuthPayload, params, requestId, logger } satisfies ApiContext<P>);

      response = await handler(request, ctx);
    } catch (error) {
      response = handleApiError(error);
    }

    response.headers.set('X-Request-Id', requestId);
    return response;
  };
}

export function withAdminApi<P = unknown>(
  handler: ApiHandler<ApiContext<P>>,
  options?: ApiHandlerOptions
): NextRouteHandler<P> {
  return createApiHandler<P>(
    'admin',
    handler as ApiHandler<ApiContext<P> | PublicApiContext<P>>,
    options
  );
}

export function withUserApi<P = unknown>(
  handler: ApiHandler<ApiContext<P>>,
  options?: ApiHandlerOptions
): NextRouteHandler<P> {
  return createApiHandler<P>(
    'user',
    handler as ApiHandler<ApiContext<P> | PublicApiContext<P>>,
    options
  );
}

export function withPublicApi<P = unknown>(
  handler: ApiHandler<PublicApiContext<P>>,
  options?: ApiHandlerOptions
): NextRouteHandler<P> {
  return createApiHandler<P>(
    'public',
    handler as ApiHandler<ApiContext<P> | PublicApiContext<P>>,
    options
  );
}
