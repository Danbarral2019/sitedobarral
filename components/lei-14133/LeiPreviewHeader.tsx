'use client';

import Link from 'next/link';
import { Search, Filter } from 'lucide-react';

interface LeiPreviewHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onlyWithDocuments: boolean;
  onToggleOnlyWithDocs: () => void;
  totalArticles: number;
  totalWithDocs: number;
}

/**
 * Cabeçalho da Lei 14.133 pública.
 *
 * Removido daqui o botão "Buscar com IA": ele não tinha onClick nem prop de
 * handler, então habilitava ao digitar e não fazia nada ao ser clicado. A
 * busca semântica existe (/api/documents/query) mas só na área restrita;
 * expô-la ao público é trabalho próprio, não um botão morto.
 */
export function LeiPreviewHeader({
  searchQuery,
  onSearchChange,
  onlyWithDocuments,
  onToggleOnlyWithDocs,
  totalArticles,
  totalWithDocs,
}: LeiPreviewHeaderProps) {
  const coveragePct = totalArticles > 0 ? Math.round((totalWithDocs / totalArticles) * 100) : 0;

  return (
    <header className="bg-surface-page border-b border-border-subtle">
      <div className="container mx-auto px-4 max-w-[1280px] pt-6 pb-7">
        <p className="text-[0.8125rem] text-ink-muted mb-3">
          <Link href="/" className="hover:text-ink-primary transition-colors">
            Início
          </Link>
          {' · '}
          <Link href="/base-conhecimento" className="hover:text-ink-primary transition-colors">
            Acervo
          </Link>
          {' · '}
          <span className="text-ink-primary">Lei 14.133/2021</span>
        </p>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-[2rem] md:text-[2.25rem] text-ink-primary mb-1.5">
              Lei 14.133/2021, comentada
            </h1>
            <p className="text-[0.9375rem] text-ink-secondary max-w-[70ch]">
              Nova Lei de Licitações e Contratos Administrativos, com o texto oficial de cada artigo
              e o que o acervo reúne sobre ele.
            </p>
          </div>

          <div className="flex gap-2 lg:flex-shrink-0">
            <div className="flex items-center gap-2.5 bg-surface-page border border-border-strong rounded-[3px] px-3.5 h-11 w-full lg:w-[360px] focus-within:border-brand-600 focus-within:ring-[3px] focus-within:ring-amber-accent/25 transition-colors">
              <Search className="w-4 h-4 text-ink-muted flex-shrink-0" aria-hidden="true" />
              <label htmlFor="lei-busca" className="sr-only">
                Buscar artigo da lei
              </label>
              <input
                id="lei-busca"
                type="search"
                placeholder="Buscar por número do artigo ou termo"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-transparent text-ink-primary placeholder:text-ink-muted outline-none text-[0.9375rem]"
              />
            </div>

            <button
              type="button"
              onClick={onToggleOnlyWithDocs}
              aria-pressed={onlyWithDocuments}
              className={`flex items-center gap-2 rounded-[3px] px-3.5 h-11 text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber-accent/25 ${
                onlyWithDocuments
                  ? 'bg-brand-600 text-surface-page border-brand-600'
                  : 'bg-surface-page text-ink-secondary border-border-strong hover:bg-surface-raised'
              }`}
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">
                {onlyWithDocuments ? 'Todos os artigos' : 'Só com documentos'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 text-[0.8125rem] text-ink-muted">
          <span>
            <span className="font-mono text-ink-primary">{totalArticles}</span> artigos
          </span>
          <span>
            <span className="font-mono text-ink-primary">{totalWithDocs}</span> com documentos
            ligados
          </span>
          <span>
            <span className="font-mono text-ink-primary">{coveragePct}%</span> de cobertura
          </span>
        </div>
      </div>
    </header>
  );
}
