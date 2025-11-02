import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from './auth';

/**
 * Tipo para funções de handler de API
 */
type ApiHandler = (request: NextRequest, context?: Record<string, unknown>) => Promise<NextResponse>;

/**
 * Middleware que protege rotas de API para admin apenas
 * Uso:
 *
 * export const GET = withAdminAuth(async (request) => {
 *   // Código que só admin pode acessar
 *   return NextResponse.json({ data: 'secret' });
 * });
 */
export function withAdminAuth(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: Record<string, unknown>) => {
    const admin = await isAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    return handler(request, context);
  };
}

/**
 * Middleware que protege rotas de API para usuários autenticados
 * Uso:
 *
 * export const GET = withAuth(async (request) => {
 *   // Código que qualquer usuário autenticado pode acessar
 *   return NextResponse.json({ data: 'content' });
 * });
 */
export function withAuth(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: Record<string, unknown>) => {
    const { getCurrentUser } = await import('./auth');
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado. Faça login.' },
        { status: 401 }
      );
    }

    return handler(request, context);
  };
}

/**
 * Helper function para verificar admin em APIs
 * Retorna { error: true, response } se não for admin
 * Retorna { error: false, user } se for admin
 */
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
