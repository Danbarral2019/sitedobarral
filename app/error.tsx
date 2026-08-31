'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Enviar para Sentry
    Sentry.captureException(error);
    console.error('Root error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-raised px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-brand-600 mb-4">Ops!</h1>
          <h2 className="text-2xl font-semibold text-ink-primary mb-2">
            Algo deu errado
          </h2>
          <p className="text-ink-muted">
            Ocorreu um erro inesperado. Por favor, tente novamente.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-[6px] text-left">
            <p className="text-sm font-mono text-red-800 break-words">
              {error.message}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-brand-600 text-white px-6 py-3 rounded-[6px] font-medium hover:bg-brand-700 transition-colors"
          >
            Tentar novamente
          </button>

          <Link
            href="/"
            className="block w-full bg-surface-deep text-ink-primary px-6 py-3 rounded-[6px] font-medium hover:bg-border-strong transition-colors"
          >
            Voltar para home
          </Link>
        </div>
      </div>
    </div>
  );
}
