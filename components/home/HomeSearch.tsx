'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

const SUGESTOES = [
  { termo: 'art. 75, II', mono: true },
  { termo: 'dispensa de baixo valor', mono: false },
  { termo: 'prorrogação de serviço contínuo', mono: false },
  { termo: 'matriz de risco', mono: false },
];

/**
 * Busca do hero da home. Encaminha para /busca?q=<termo>.
 *
 * As sugestões abaixo do campo não são decoração: ensinam a forma da consulta
 * (número de artigo, tema, instituto) para quem chega sem saber o que o acervo
 * responde. Cada uma dispara a busca real.
 */
export default function HomeSearch({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [term, setTerm] = useState('');

  function buscar(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/busca?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className={className}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          buscar(term);
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <label htmlFor="home-search" className="sr-only">
          Pesquisar no acervo
        </label>
        <div className="flex-1 flex items-center gap-3 bg-surface-page border border-border-strong rounded-[3px] px-4 h-14 focus-within:border-brand-600 focus-within:ring-[3px] focus-within:ring-amber-accent/25 transition-colors">
          <Search className="w-5 h-5 text-ink-muted flex-shrink-0" aria-hidden="true" />
          <input
            id="home-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Pesquisar por tema, artigo da lei ou número de acórdão"
            className="w-full bg-transparent text-ink-primary placeholder:text-ink-muted outline-none text-base"
          />
        </div>
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-800 text-surface-page font-semibold text-[0.9375rem] rounded-[3px] h-14 px-8 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-accent/25 whitespace-nowrap"
        >
          Buscar
        </button>
      </form>

      <div className="flex items-center gap-2 flex-wrap mt-4">
        <span className="text-sm text-ink-muted mr-1">Buscas frequentes:</span>
        {SUGESTOES.map((s) => (
          <button
            key={s.termo}
            type="button"
            onClick={() => buscar(s.termo)}
            className={`bg-surface-raised border border-border-subtle rounded-[3px] px-2.5 py-1 text-sm transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-accent/25 ${
              s.mono ? 'font-mono text-brand-600' : 'text-ink-secondary'
            }`}
          >
            {s.termo}
          </button>
        ))}
      </div>
    </div>
  );
}
