import { NextRequest, NextResponse } from 'next/server';
import { withPublicApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import { unsubscribeNewsletterByToken } from '@/lib/newsletter/subscriptions';

/**
 * Descadastro da newsletter por link assinado.
 *
 * POST /api/newsletter/unsubscribe
 * - Token em `?token=` (List-Unsubscribe-Post, RFC 8058: o provedor de e-mail
 *   posta `List-Unsubscribe=One-Click` na URL do cabeçalho) ou no corpo JSON
 *   `{ token }` (botão da página /cancelar-newsletter).
 * - Sem token válido, nada é alterado.
 *
 * GET redireciona para a página, que pede um clique antes de cancelar: assim
 * os verificadores de link dos provedores não descadastram ninguém sozinhos.
 */

async function readToken(request: NextRequest): Promise<string | null> {
  const fromQuery = request.nextUrl.searchParams.get('token');
  if (fromQuery) return fromQuery;

  try {
    const raw = await request.text();
    if (!raw) return null;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = JSON.parse(raw) as { token?: unknown };
      return typeof body.token === 'string' ? body.token : null;
    }
    return new URLSearchParams(raw).get('token');
  } catch {
    return null;
  }
}

export const POST = withPublicApi(async (request, ctx) => {
  const token = await readToken(request);
  const status = await unsubscribeNewsletterByToken(token);

  if (status === 'invalid') {
    ctx.logger.warn('Descadastro da newsletter com token inválido');
    throw new ValidationError('Link de descadastro inválido.');
  }

  return NextResponse.json({ status });
});

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const target = new URL('/cancelar-newsletter', request.nextUrl.origin);
  if (token) target.searchParams.set('token', token);
  return NextResponse.redirect(target, 303);
}
