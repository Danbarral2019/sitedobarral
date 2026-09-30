'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

type State = 'idle' | 'submitting' | 'done' | 'error';

export default function UnsubscribeConfirm({ token }: { token: string }) {
  const [state, setState] = useState<State>('idle');

  const handleClick = async () => {
    setState('submitting');
    try {
      const response = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      setState(response.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-[6px] border-2 border-border-subtle p-8 md:p-12 text-center">
          {state === 'done' ? (
            <>
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-white" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-bold text-ink-primary mb-4">Inscrição cancelada</h1>
              <p className="text-lg text-ink-secondary mb-2">
                Você não receberá mais a newsletter neste e-mail.
              </p>
              <p className="text-ink-muted">
                Se mudar de ideia, basta se inscrever de novo no formulário do site.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-red-600" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-bold text-ink-primary mb-4">
                Cancelar inscrição na newsletter
              </h1>
              <p className="text-lg text-ink-secondary mb-8">
                Confirme o cancelamento no botão abaixo. Você deixará de receber a newsletter
                neste e-mail.
              </p>
              {state === 'error' && (
                <div role="alert" className="bg-red-50 border-2 border-red-500 rounded-[6px] p-4 mb-6">
                  <p className="text-red-800 font-medium">
                    Não foi possível cancelar a inscrição. Tente de novo em instantes.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={handleClick}
                disabled={state === 'submitting'}
                className="w-full bg-red-600 text-white px-6 py-4 rounded-[6px] font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {state === 'submitting' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    Cancelando inscrição...
                  </>
                ) : (
                  'Confirmar cancelamento'
                )}
              </button>
            </>
          )}
          <Link
            href="/"
            className="inline-block mt-8 text-primary-600 hover:text-primary-700 font-semibold"
          >
            Voltar para o site
          </Link>
        </div>
      </div>
    </div>
  );
}
