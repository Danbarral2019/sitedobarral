'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** Chamada para a Lei 14.133 comentada, depois dos resultados da listagem. */
export function LegislacaoHighlightCard() {
  return (
    <aside className="mt-12 rounded-[6px] border border-border-subtle bg-surface-raised px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-ink-primary">Lei 14.133/2021 comentada</h2>
        <p className="text-sm text-ink-secondary mt-0.5">Os 195 artigos com jurisprudência e doutrina.</p>
      </div>
      <Link
        href="/lei-14133"
        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-[6px] hover:bg-brand-700 transition-colors font-semibold"
      >
        Abrir a Lei comentada
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}
