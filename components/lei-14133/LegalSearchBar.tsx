'use client';

/**
 * LegalSearchBar — busca sticky no topo do reading view.
 *
 * Filtragem client-side: scroll para o primeiro artigo que match. Atalho `/`
 * foca o input. Esc limpa.
 */

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function LegalSearchBar() {
  const [searchTerm, setSearchTerm] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho `/` foca, Esc limpa
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setSearchTerm('');
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Filtragem: marca articles que dão match e scroll pro primeiro
  useEffect(() => {
    const q = normalize(searchTerm.trim());
    const articles = document.querySelectorAll<HTMLElement>('[id^="art-"]');

    if (!q) {
      articles.forEach((a) => {
        a.style.display = '';
        a.removeAttribute('data-search-match');
      });
      setMatchCount(null);
      return;
    }

    let count = 0;
    let firstMatch: HTMLElement | null = null;

    articles.forEach((a) => {
      const numero = a.id.replace('art-', '');
      const article = LEI_14133_ARTIGOS[numero];
      if (!article) {
        a.style.display = 'none';
        return;
      }

      // Match por número exato
      if (numero === q) {
        a.style.display = '';
        a.setAttribute('data-search-match', 'true');
        count++;
        if (!firstMatch) firstMatch = a;
        return;
      }

      // Match por texto na ementa
      const haystack = normalize(`${article.ementa} ${numero}`);
      if (haystack.includes(q)) {
        a.style.display = '';
        a.setAttribute('data-search-match', 'true');
        count++;
        if (!firstMatch) firstMatch = a;
      } else {
        a.style.display = 'none';
        a.removeAttribute('data-search-match');
      }
    });

    setMatchCount(count);

    // Scroll suave pro primeiro match (com debounce implícito do useEffect)
    if (firstMatch && q.length >= 2) {
      const matchEl = firstMatch as HTMLElement;
      const top = matchEl.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, [searchTerm]);

  return (
    <div className="sticky top-0 z-20 bg-surface-page/95 backdrop-blur-sm border-b border-border-subtle">
      <div className="px-6 lg:px-10 py-3 flex items-center gap-4">
        <div className="flex-shrink-0 hidden md:block">
          <p className="font-label text-ink-muted">Lei 14.133/2021</p>
        </div>
        <div className="relative flex-1 max-w-2xl">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar artigo, tema ou número..."
            aria-label="Buscar na Lei 14.133"
            className="w-full pl-9 pr-12 py-2 bg-surface-page border border-border-subtle rounded text-sm text-ink-primary font-sans placeholder:text-ink-muted focus:outline-none focus:border-amber-accent focus:ring-2 focus:ring-amber-accent focus:ring-opacity-25"
          />
          {searchTerm ? (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-primary"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-ink-muted px-1.5 py-0.5 border border-border-subtle rounded bg-surface-raised">
              /
            </kbd>
          )}
        </div>
        {matchCount !== null && (
          <span className="font-mono text-xs text-ink-muted tabular-nums whitespace-nowrap">
            {matchCount} {matchCount === 1 ? 'artigo' : 'artigos'}
          </span>
        )}
      </div>
    </div>
  );
}
