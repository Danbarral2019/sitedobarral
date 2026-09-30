import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/site-metadata';
import { inspectConfirmationToken } from '@/lib/newsletter/subscriptions';
import ConfirmButton, { ConfirmOutcome } from './ConfirmButton';

export const metadata: Metadata = {
  title: 'Confirmar Inscrição na Newsletter',
  robots: NOINDEX,
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * O GET só valida o link (não altera nada). A confirmação exige o clique no
 * botão, que faz POST /api/newsletter/confirm: assim os verificadores de link
 * dos provedores de e-mail não confirmam a inscrição sozinhos.
 */
export default async function ConfirmarNewsletterPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const state = await inspectConfirmationToken(token);

  if (state === 'pending' && token) {
    return <ConfirmButton token={token} />;
  }

  return <ConfirmOutcome status={state === 'pending' ? 'invalid' : state} />;
}
