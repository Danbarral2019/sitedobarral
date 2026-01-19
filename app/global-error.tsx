'use client';

/**
 * Global Error Handler for Next.js App Router
 *
 * This component catches errors at the root level and reports them to Sentry.
 * It also provides a fallback UI for users when something goes wrong.
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-gray-50">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            {/* Error Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
              <svg
                className="w-10 h-10 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Algo deu errado
            </h1>

            {/* Description */}
            <p className="text-gray-600 mb-6">
              Ocorreu um erro inesperado. Nossa equipe foi notificada e está trabalhando para resolver o problema.
            </p>

            {/* Error ID (for support) */}
            {error.digest && (
              <p className="text-xs text-gray-400 mb-6">
                ID do erro: {error.digest}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={reset}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Tentar novamente
              </button>
              <a
                href="/"
                className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors inline-block"
              >
                Voltar para o início
              </a>
            </div>

            {/* Help */}
            <p className="mt-6 text-sm text-gray-500">
              Precisa de ajuda?{' '}
              <a
                href="mailto:suporte@profdanielbarral.com"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Entre em contato
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
