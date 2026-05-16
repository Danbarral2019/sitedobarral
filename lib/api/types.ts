import type { NextRequest, NextResponse } from 'next/server';
import type { AuthPayload } from '@/lib/auth';
import type { Logger } from 'pino';

/**
 * Modo de proteção aplicado pelo helper. **Não é** o role do usuário —
 * é o tipo de wrapper.
 *
 * - `'admin'`: exige `user.role === 'admin'` (AuthPayload.role)
 * - `'user'`:  exige qualquer usuário autenticado (admin OU student do AuthPayload)
 * - `'public'`: não autentica
 */
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

/**
 * Assinatura de handler de rota recebida pelos helpers. O `context` já
 * contém `params` (resolvido), `user`, `requestId` e `logger` — não é
 * necessário (nem suportado) passar `Params` como parâmetro separado.
 */
export type ApiHandler<Ctx> = (
  request: NextRequest,
  context: Ctx
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
