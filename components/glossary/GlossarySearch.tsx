'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface GlossarySearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function GlossarySearch({ onSearch, placeholder = 'Buscar termo...' }: GlossarySearchProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Debounce da busca
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-ink-muted" />
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-10 pr-3 py-3 border border-border-subtle rounded-[6px] leading-5 bg-white placeholder-ink-muted focus:outline-none focus:placeholder-ink-muted focus:ring-2 focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
      />
    </div>
  );
}
