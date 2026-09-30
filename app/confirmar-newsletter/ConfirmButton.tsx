'use client';

import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import NewsletterStatusCard from '@/components/newsletter/NewsletterStatusCard';

type Outcome = 'confirmed' | 'already' | 'expired' | 'invalid';

/** Mensagens dos quatro estados da confirmação. */
export function ConfirmOutcome({ status }: { status: Outcome }) {
  if (status === 'confirmed') {
    return (
      <NewsletterStatusCard tone="success" title="Inscrição confirmada">
        <p>Pronto. A partir de agora você receberá a newsletter no e-mail confirmado.</p>
        <p className="text-base text-ink-muted">
          Cada edição traz, no rodapé, um link para cancelar a inscrição quando quiser.
        </p>
      </NewsletterStatusCard>
    );
  }
  if (status === 'already') {
    return (
      <NewsletterStatusCard tone="info" title="Inscrição já confirmada">
        <p>Este e-mail já estava confirmado. Não é preciso fazer mais nada.</p>
      </NewsletterStatusCard>
    );
  }
  if (status === 'expired') {
    return (
      <NewsletterStatusCard tone="error" title="Link expirado">
        <p>O prazo deste link de confirmação terminou.</p>
        <p className="text-base text-ink-muted">
          Faça a inscrição de novo no formulário do site para receber um novo link.
        </p>
      </NewsletterStatusCard>
    );
  }
  return (
    <NewsletterStatusCard tone="error" title="Link inválido">
      <p>Não foi possível validar este link de confirmação.</p>
      <p className="text-base text-ink-muted">
        Confira se o endereço foi copiado por inteiro ou faça a inscrição de novo no formulário do site.
      </p>
    </NewsletterStatusCard>
  );
}

export default function ConfirmButton({ token }: { token: string }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  const handleClick = async () => {
    setSubmitting(true);
    setNetworkError(false);
    try {
      const response = await fetch('/api/newsletter/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json().catch(() => ({}))) as { status?: Outcome };
      if (data.status && ['confirmed', 'already', 'expired', 'invalid'].includes(data.status)) {
        setOutcome(data.status);
      } else {
        setNetworkError(true);
      }
    } catch {
      setNetworkError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (outcome) return <ConfirmOutcome status={outcome} />;

  return (
    <NewsletterStatusCard tone="info" title="Confirmar inscrição na newsletter">
      <p>Para começar a receber a newsletter neste e-mail, confirme a inscrição no botão abaixo.</p>
      {networkError && (
        <div role="alert" className="bg-red-50 border-2 border-red-500 rounded-[6px] p-4">
          <p className="text-red-800 font-medium text-base">
            Não foi possível confirmar agora. Tente de novo em instantes.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="w-full bg-primary-600 text-white px-6 py-4 rounded-[6px] font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Confirmando...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" aria-hidden="true" />
            Confirmar inscrição
          </>
        )}
      </button>
    </NewsletterStatusCard>
  );
}
