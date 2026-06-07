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
      <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-4 shadow-lg">
        <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <input
          id="home-hero-search"
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Pesquisar acórdãos, pareceres, Lei 14.133…"
          className="w-full py-3.5 bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none font-poppins"
        />
      </div>
      <button
        type="submit"
        className="bg-amber-400 text-brand-700 font-poppins font-semibold px-6 py-3.5 rounded-xl hover:bg-amber-500 transition-colors shadow-lg whitespace-nowrap"
      >
        <span className="sm:hidden">Buscar no acervo</span>
        <span className="hidden sm:inline">Buscar</span>
      </button>
    </form>
  );
}
