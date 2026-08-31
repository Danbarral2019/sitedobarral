'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AreaRestritaError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 useEffect(() => {
 console.error('Área Restrita error:', error);
 }, [error]);

 return (
 <div className="min-h-screen flex items-center justify-center bg-surface-raised px-4">
 <div className="max-w-md w-full text-center">
 <div className="mb-8">
 <div className="w-20 h-20 bg-surface-deep rounded-full flex items-center justify-center mx-auto mb-4">
 <svg
 className="w-10 h-10 text-semantic-error"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
 />
 </svg>
 </div>

 <h2 className="text-2xl font-semibold text-ink-primary mb-2">
 Erro na Área Restrita
 </h2>
 <p className="text-ink-secondary">
 Não foi possível carregar o conteúdo. Verifique sua conexão e tente novamente.
 </p>
 </div>

 {process.env.NODE_ENV === 'development' && error.message && (
 <div className="mb-6 p-4 bg-surface-raised border border-border-subtle rounded-[3px] text-left">
 <p className="text-xs font-mono text-semantic-error break-words">
 {error.message}
 </p>
 </div>
 )}

 <div className="space-y-3">
 <button
 onClick={reset}
 className="w-full bg-brand-600 text-surface-page px-6 py-3 rounded-[3px] font-medium hover:bg-brand-800 transition-colors"
 >
 Tentar novamente
 </button>

 <Link
 href="/area-restrita"
 className="block w-full bg-surface-deep text-ink-primary px-6 py-3 rounded-[3px] font-medium hover:bg-border-strong transition-colors"
 >
 Voltar para área restrita
 </Link>

 <Link
 href="/"
 className="block text-sm text-ink-secondary hover:text-ink-primary mt-4"
 >
 Ir para página inicial
 </Link>
 </div>
 </div>
 </div>
 );
}
