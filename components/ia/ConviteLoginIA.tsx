'use client';

import Link from 'next/link';
import { LogIn, Sparkles } from 'lucide-react';

interface ConviteLoginIAProps {
  /** Página para onde o login deve devolver o usuário. */
  returnTo?: string;
  /** Nome do recurso de IA exibido no convite. */
  recurso?: string;
}

/**
 * Convite a entrar ou cadastrar-se, exibido no lugar dos recursos de IA
 * quando não há sessão (as rotas de IA exigem login desde 30/09/2026).
 */
export function ConviteLoginIA({ returnTo, recurso = 'A busca com IA' }: ConviteLoginIAProps) {
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';

  return (
    <div className="text-center py-8 px-4" role="status">
      <Sparkles className="w-10 h-10 text-brand-600 mx-auto mb-3" aria-hidden="true" />
      <p className="font-semibold text-ink-primary">{recurso} é exclusiva para usuários cadastrados.</p>
      <p className="text-sm text-ink-muted mt-2">
        Entre na sua conta ou crie um cadastro gratuito para continuar.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={loginHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-[6px] font-bold hover:bg-brand-700 transition-colors"
        >
          <LogIn className="w-4 h-4" aria-hidden="true" />
          Entrar
        </Link>
        <Link
          href="/registro"
          className="inline-flex items-center px-5 py-2.5 text-ink-secondary border-2 border-border-subtle rounded-[6px] font-bold hover:border-border-strong transition-colors"
        >
          Criar cadastro
        </Link>
      </div>
    </div>
  );
}
