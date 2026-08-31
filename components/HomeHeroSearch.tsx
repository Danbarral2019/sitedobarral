'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

interface HomeHeroSearchProps {
  className?: string;
}

/**
 * Barra de busca do hero da home. Encaminha o termo para /busca?q=<termo>.
 * Desktop: campo + botão na mesma linha. Mobile: empilhado (campo em cima,
 * botão "Buscar no acervo" full width embaixo).
 */
export default function HomeHeroSearch({ className = '' }: HomeHeroSearchProps) {
  const router = useRouter();
  const [term, setTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = term.trim();
    if (!trimmed) return;
    router.push(`/busca?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={`flex flex-col sm:flex-row gap-3 ${className}`}
    >
      <label htmlFor="home-hero-search" className="sr-only">
        Pesquisar no acervo
      </label>
      <div className="flex-1 flex items-center gap-2 bg-white rounded-[6px] px-4 border border-border-subtle">
        <Search className="w-5 h-5 text-ink-muted flex-shrink-0" />
        <input
          id="home-hero-search"
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Pesquisar acórdãos, pareceres, Lei 14.133…"
          className="w-full py-3.5 bg-transparent text-ink-primary placeholder:text-ink-muted focus:outline-none font-poppins"
        />
      </div>
      <button
        type="submit"
        className="bg-amber-accent text-brand-700 font-poppins font-semibold px-6 py-3.5 rounded-[6px] hover:bg-amber-accent transition-colors whitespace-nowrap border border-border-subtle"
      >
        <span className="sm:hidden">Buscar no acervo</span>
        <span className="hidden sm:inline">Buscar</span>
      </button>
    </form>
  );
}
