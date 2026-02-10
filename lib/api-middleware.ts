import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters } from './rate-limit';

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
      // ✅ Rate limiting ANTES de autenticação (previne ataques)
      try {
        await rateLimiters.api.check(request, 30); // 30 requests/minuto para admin
      } catch {
        return NextResponse.json(
          { error: 'Muitas requisições. Aguarde alguns instantes.' },
          { status: 429 }
        );
      }

      const { getCurrentUser } = await import('./auth');
      const user = await getCurrentUser();

      if (!user || user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Acesso negado. Apenas administradores.' },
          { status: 403 }
        );
      }

      // Passa o usuário autenticado no context para o handler
      return handler(request, { ...context, user });
    } catch (error) {
      // Captura qualquer erro não tratado na autenticação
      console.error('=== [withAdminAuth MIDDLEWARE] ERRO CAPTURADO ===');
      console.error('URL:', request.url);
      console.error('Method:', request.method);
      console.error('Erro completo:', error);
      console.error('Tipo do erro:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Mensagem:', error instanceof Error ? error.message : String(error));
      console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
      console.error('======================================');

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
      // ✅ Rate limiting (mais permissivo para usuários autenticados)
      try {
        await rateLimiters.api.check(request, 60); // 60 requests/minuto
      } catch {
        return NextResponse.json(
          { error: 'Muitas requisições. Aguarde alguns instantes.' },
          { status: 429 }
        );
      }

      const { getCurrentUser } = await import('./auth');
      const user = await getCurrentUser();

      if (!user) {
        return NextResponse.json(
          { error: 'Não autenticado. Faça login.' },
          { status: 401 }
        );
      }

      // Passa o usuário autenticado no context para o handler
      return handler(request, { ...context, user });
    } catch (error) {
      // Captura qualquer erro não tratado na autenticação
      console.error('=== [withAuth MIDDLEWARE] ERRO CAPTURADO ===');
      console.error('URL:', request.url);
      console.error('Method:', request.method);
      console.error('Erro completo:', error);
      console.error('Tipo do erro:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Mensagem:', error instanceof Error ? error.message : String(error));
      console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
      console.error('======================================');

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
