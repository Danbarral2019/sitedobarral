import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { enforceRateLimit, getClientIp } from '@/lib/cache/rate-limit-helper';
import { RateLimitError } from '@/lib/errors/api-error';
import { apiLogger } from "@/lib/logger";

/**
 * Tipo para funções de handler de API
 * Usa `any` para context para compatibilidade com Next.js 15 RouteContext
 * (o middleware apenas repassa o context, não inspeciona sua estrutura)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler = (request: NextRequest, context?: any) => Promise<NextResponse>;

/**
 * Middleware que protege rotas de API para admin apenas
 * ✅ Inclui rate limiting automático (30 req/min)
 *
 * Uso:
 *
 * export const GET = withAdminAuth(async (request, context) => {
 *   // Código que só admin pode acessar
 *   // context.user contém dados do admin autenticado
 *   return NextResponse.json({ data: 'secret' });
 * });
 */
export function withAdminAuth(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: Record<string, unknown>) => {
    try {
      // ✅ Rate limiting ANTES de autenticação (Redis)
      const adminIp = getClientIp(request);
      await enforceRateLimit(`middleware:admin:${adminIp}`, 30, 60);

      const { getCurrentUser } = await import('./auth');
      const user = await getCurrentUser();

      if (!user || user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Acesso negado. Apenas administradores.' },
          { status: 403 }
        );
      }

      // Set Sentry user context for error tracking
      Sentry.setUser({ id: user.userId, email: user.email, role: user.role });

      // Passa o usuário autenticado no context para o handler
      return handler(request, { ...context, user });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { error: 'Muitas requisições. Aguarde alguns instantes.' },
          { status: 429 }
        );
      }
      // Captura qualquer erro não tratado na autenticação
      apiLogger.error('=== [withAdminAuth MIDDLEWARE] ERRO CAPTURADO ===');
      apiLogger.error({ err: request.url }, 'URL:');
      apiLogger.error({ err: request.method }, 'Method:');
      apiLogger.error({ err: error }, 'Erro completo:');
      apiLogger.error({ err: error instanceof Error ? error.constructor.name : typeof error }, 'Tipo do erro:');
      apiLogger.error({ err: error instanceof Error ? error.message : String(error) }, 'Mensagem:');
      apiLogger.error({ err: error instanceof Error ? error.stack : 'N/A' }, 'Stack trace:');
      apiLogger.error('======================================');

      return NextResponse.json(
        { error: 'Erro de autenticação interna' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware que protege rotas de API para usuários autenticados
 * ✅ Inclui rate limiting automático (60 req/min)
 *
 * Uso:
 *
 * export const GET = withAuth(async (request, context) => {
 *   // Código que qualquer usuário autenticado pode acessar
 *   // context.user contém dados do usuário autenticado
 *   return NextResponse.json({ data: 'content' });
 * });
 */
export function withAuth(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: Record<string, unknown>) => {
    try {
      // ✅ Rate limiting (mais permissivo para usuários autenticados, Redis)
      const authIp = getClientIp(request);
      await enforceRateLimit(`middleware:auth:${authIp}`, 60, 60);

      const { getCurrentUser } = await import('./auth');
      const user = await getCurrentUser();

      if (!user) {
        return NextResponse.json(
          { error: 'Não autenticado. Faça login.' },
          { status: 401 }
        );
      }

      // Set Sentry user context for error tracking
      Sentry.setUser({ id: user.userId, email: user.email, role: user.role });

      // Passa o usuário autenticado no context para o handler
      return handler(request, { ...context, user });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { error: 'Muitas requisições. Aguarde alguns instantes.' },
          { status: 429 }
        );
      }
      // Captura qualquer erro não tratado na autenticação
      apiLogger.error('=== [withAuth MIDDLEWARE] ERRO CAPTURADO ===');
      apiLogger.error({ err: request.url }, 'URL:');
      apiLogger.error({ err: request.method }, 'Method:');
      apiLogger.error({ err: error }, 'Erro completo:');
      apiLogger.error({ err: error instanceof Error ? error.constructor.name : typeof error }, 'Tipo do erro:');
      apiLogger.error({ err: error instanceof Error ? error.message : String(error) }, 'Mensagem:');
      apiLogger.error({ err: error instanceof Error ? error.stack : 'N/A' }, 'Stack trace:');
      apiLogger.error('======================================');

      return NextResponse.json(
        { error: 'Erro de autenticação interna' },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper function para verificar admin em APIs
 * Retorna { error: true, response } se não for admin
 * Retorna { error: false, user } se for admin
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function verifyAdmin(request: NextRequest): Promise<
  | { error: true; response: NextResponse; user?: never }
  | { error: false; response?: never; user: import('./auth').AuthPayload }
> {
  const { getCurrentUser } = await import('./auth');
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    return {
      error: true,
      response: NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      )
    };
  }

  return { error: false, user };
}
