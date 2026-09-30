import { NextResponse } from 'next/server';
import { withPublicApi } from '@/lib/api/handler';
import { confirmNewsletterSubscription } from '@/lib/newsletter/subscriptions';

/**
 * POST /api/newsletter/confirm  { token }
 *
 * Confirma a inscrição (double opt-in). Só por POST, disparado pelo botão da
 * página /confirmar-newsletter: o GET da página apenas valida o link, para que
 * os verificadores de link dos provedores de e-mail não confirmem sozinhos.
 */
export const POST = withPublicApi(async (request, ctx) => {
  let token: unknown = null;
  try {
    const body = (await request.json()) as { token?: unknown };
    token = body?.token;
  } catch {
    token = null;
  }

  const status = await confirmNewsletterSubscription(token);

  if (status === 'expired' || status === 'invalid') {
    ctx.logger.warn({ status }, 'Confirmação da newsletter recusada');
    return NextResponse.json({ status }, { status: 400 });
  }

  return NextResponse.json({ status });
});
