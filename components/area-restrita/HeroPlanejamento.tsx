'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scale, ArrowRight, FileText, Sparkles } from 'lucide-react';

/**
 * Card de destaque para o módulo Planejamento (ETP/TR/Matriz) na home
 * da área restrita. Busca a contagem de sessões do aluno para decidir
 * se o CTA secundário "Minhas contratações" aparece.
 */
export function HeroPlanejamento() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/planejamento/sessions', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          sessions?: Array<unknown>;
        };
        if (!cancelled && Array.isArray(data.sessions)) {
          setCount(data.sessions.length);
        }
      } catch {
        /* silencioso — hero não é bloqueante */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-6 text-white shadow-sm lg:p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide backdrop-blur-sm">
              <Sparkles className="h-3 w-3" /> Novo
            </span>
            <span className="text-[11px] uppercase tracking-wide text-white/70">
              Módulo prático
            </span>
          </div>

          <h2 className="font-serif text-2xl leading-tight text-white lg:text-3xl">
            Elabore ETP, TR e matriz de decisão
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90 lg:text-base">
            Construa os documentos de planejamento da contratação com
            assistência guiada da IA, ancorada na base do curso. Exporte
            direto para o SEI, Word ou PDF.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link
              href="/area-restrita/planejamento/nova"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50"
            >
              <FileText className="h-4 w-4" />
              Iniciar nova contratação
              <ArrowRight className="h-4 w-4" />
            </Link>
            {count !== null && count > 0 && (
              <Link
                href="/area-restrita/planejamento"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Minhas contratações ({count})
              </Link>
            )}
          </div>
        </div>

        <div className="relative hidden shrink-0 lg:block">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
            <Scale className="h-16 w-16 text-white/90" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroPlanejamento;
