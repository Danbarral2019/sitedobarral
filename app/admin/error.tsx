'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin panel error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Erro no Painel Administrativo
            </h2>
            <p className="text-sm text-gray-600">
              Ocorreu um erro ao processar sua solicitação.
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && error.message && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-left">
              <p className="text-xs font-mono text-red-800 break-words">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-gray-500 mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition-colors"
            >
              Tentar novamente
            </button>

            <Link
              href="/admin"
              className="block w-full bg-gray-200 text-gray-900 px-4 py-2 rounded font-medium hover:bg-gray-300 transition-colors text-center"
            >
              Voltar ao Dashboard
            </Link>
          </div>

          <p className="text-xs text-gray-500 text-center mt-6">
            Se o problema persistir, entre em contato com o suporte técnico.
          </p>
        </div>
      </div>
    </div>
  );
}
