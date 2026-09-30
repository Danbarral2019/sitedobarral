import { isValidUnsubscribeToken } from '@/lib/newsletter/subscriptions';
import NewsletterStatusCard from '@/components/newsletter/NewsletterStatusCard';
import UnsubscribeConfirm from './UnsubscribeConfirm';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Descadastro da newsletter. Só funciona com o link assinado do rodapé dos
 * e-mails; a página valida o token e pede um clique antes de cancelar, para que
 * os verificadores de link dos provedores não descadastrem ninguém sozinhos.
 */
export default async function CancelarNewsletterPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token || !isValidUnsubscribeToken(token)) {
    return (
      <NewsletterStatusCard tone="info" title="Cancelar inscrição na newsletter">
        <p>
          Para cancelar a inscrição, use o link <strong>Cancelar inscrição</strong> que está no
          rodapé de qualquer e-mail da newsletter.
        </p>
        <p className="text-base text-ink-muted">
          {token
            ? 'O link acessado não é válido. Confira se o endereço foi copiado por inteiro.'
            : 'Por segurança, o cancelamento não é feito apenas com o endereço de e-mail.'}
        </p>
      </NewsletterStatusCard>
    );
  }

  return <UnsubscribeConfirm token={token} />;
}
