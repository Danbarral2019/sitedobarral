'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GlossarySearch } from '@/components/glossary/GlossarySearch';
import { AlphabeticalNav } from '@/components/glossary/AlphabeticalNav';
import { CategoryFilter } from '@/components/glossary/CategoryFilter';
import { GlossaryTermCard } from '@/components/glossary/GlossaryTermCard';
import { BookOpen, Loader2 } from 'lucide-react';

interface GlossaryTerm {
  id: string;
  term: string;
  slug: string;
  definition: string;
  shortDef?: string | null;
  category?: string | null;
  viewCount: number;
  leiArticlesArr?: string[];
  relatedTerms?: string | null;
  resolvedRelatedTerms?: Array<{ id: string; term: string; slug: string }>;
}

interface GlossaryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface GlossaryResponse {
  terms: GlossaryTerm[];
  categories: string[];
  availableLetters: string[];
  pagination: GlossaryPagination;
}

const PAGE_SIZE = 30;
const INITIAL_PAGINATION: GlossaryPagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasMore: false,
};

export default function GlossarioPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [pagination, setPagination] = useState(INITIAL_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const fetchTerms = useCallback(async (page: number, append: boolean) => {
    const requestId = ++requestSequence.current;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (activeLetter) params.set('letter', activeLetter);
    if (activeCategory) params.set('category', activeCategory);

    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/glossary?${params.toString()}`);
      if (!response.ok) throw new Error('Falha ao carregar o glossário');

      const data = await response.json() as GlossaryResponse;
      if (requestSequence.current !== requestId) return;

      setTerms((current) => append ? [...current, ...(data.terms || [])] : (data.terms || []));
      setCategories(data.categories || []);
      setAvailableLetters(data.availableLetters || []);
      setPagination(data.pagination || INITIAL_PAGINATION);
    } catch (fetchError) {
      if (requestSequence.current !== requestId) return;
      console.error('Erro ao buscar termos:', fetchError);
      setError('Não foi possível carregar os termos. Tente novamente.');
      if (!append) setTerms([]);
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeCategory, activeLetter, searchQuery]);

  useEffect(() => {
    void fetchTerms(1, false);
  }, [fetchTerms]);

  const handleSearch = useCallback((query: string) => {
    setExpandedTermId(null);
    setSearchQuery(query);
  }, []);

  const handleLetterClick = useCallback((letter: string | null) => {
    setExpandedTermId(null);
    setActiveLetter(letter);
  }, []);

  const handleCategoryChange = useCallback((category: string | null) => {
    setExpandedTermId(null);
    setActiveCategory(category);
  }, []);

  return (
    <div className="min-h-screen bg-surface-raised">
      {/* Hero Section */}
      <div className="bg-brand-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <BookOpen className="h-16 w-16" />
            </div>
            <h1 className="text-4xl font-bold mb-4 font-heading">
              Glossário de Licitações
            </h1>
            <p className="text-xl text-brand-100 max-w-2xl mx-auto">
              Termos técnicos de licitações e contratos administrativos explicados de forma clara e objetiva
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search Bar */}
        <div className="mb-8">
          <GlossarySearch onSearch={handleSearch} />
        </div>

        {/* Filters */}
        <div className="space-y-6 mb-8">
          <AlphabeticalNav
            activeLetter={activeLetter}
            onLetterClick={handleLetterClick}
            availableLetters={availableLetters}
          />

          <CategoryFilter
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <span className="ml-2 text-ink-muted">Carregando termos...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12" role="alert">
            <BookOpen className="h-16 w-16 text-ink-muted mx-auto mb-4" />
            <p className="text-ink-secondary mb-4">{error}</p>
            <button
              type="button"
              onClick={() => void fetchTerms(1, false)}
              className="px-4 py-2 rounded-md bg-brand-600 text-white font-medium hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              Tentar novamente
            </button>
          </div>
        ) : terms.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-ink-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-ink-primary mb-2">
              Nenhum termo encontrado
            </h3>
            <p className="text-ink-muted">
              {searchQuery
                ? `Não encontramos termos para "${searchQuery}"`
                : 'Não há termos para os filtros selecionados'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-ink-muted" aria-live="polite">
              Exibindo {terms.length} de {pagination.total} {pagination.total === 1 ? 'termo' : 'termos'}
              {searchQuery && ` para "${searchQuery}"`}
              {activeLetter && ` começando com "${activeLetter}"`}
              {activeCategory && ` na categoria "${activeCategory}"`}
            </div>

            <div className="bg-white rounded-[6px] border border-border-subtle divide-y divide-border-subtle">
              {terms.map((term) => (
                <GlossaryTermCard
                  key={term.id}
                  term={term}
                  isExpanded={expandedTermId === term.id}
                  onToggle={() => setExpandedTermId(expandedTermId === term.id ? null : term.id)}
                />
              ))}
            </div>

            {pagination.hasMore && (
              <div className="flex flex-col items-center gap-2 pt-8">
                <span className="text-xs text-ink-muted">
                  {terms.length} de {pagination.total} termos carregados
                </span>
                <button
                  type="button"
                  onClick={() => void fetchTerms(pagination.page + 1, true)}
                  disabled={loadingMore}
                  className="inline-flex min-w-40 items-center justify-center rounded-md border border-brand-600 bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    'Carregar mais'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
