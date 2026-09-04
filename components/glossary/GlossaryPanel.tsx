'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GlossarySearch } from './GlossarySearch';
import { AlphabeticalNav } from './AlphabeticalNav';
import { CategoryFilter } from './CategoryFilter';
import { GlossaryTermCard } from './GlossaryTermCard';
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
  resolvedRelatedTerms?: { id: string; term: string; slug: string }[];
}

interface GlossaryPanelProps {
  articleBasePath?: string;
}

interface GlossaryPagination {
  page: number;
  total: number;
  hasMore: boolean;
}

const PAGE_SIZE = 30;
const INITIAL_PAGINATION: GlossaryPagination = { page: 1, total: 0, hasMore: false };

export function GlossaryPanel({ articleBasePath = '/area-restrita/artigo' }: GlossaryPanelProps) {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [pagination, setPagination] = useState(INITIAL_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const fetchTerms = useCallback(async (page: number, append: boolean) => {
    const requestId = ++requestSequence.current;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (activeLetter) params.set('letter', activeLetter);
    if (activeCategory) params.set('category', activeCategory);

    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const response = await fetch(`/api/glossary?${params.toString()}`);
      if (!response.ok) throw new Error('Falha ao carregar o glossário');

      const data = await response.json();
      if (requestSequence.current !== requestId) return;

      setTerms((current) => append ? [...current, ...(data.terms || [])] : (data.terms || []));
      setCategories(data.categories || []);
      setAvailableLetters(data.availableLetters || []);
      setPagination(data.pagination || INITIAL_PAGINATION);
    } catch (error) {
      console.error('Erro ao buscar termos:', error);
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

  const handleTermClick = useCallback((slug: string) => {
    const found = terms.find(t => t.slug === slug);
    if (found) {
      setExpandedTermId(found.id);
      // Scroll to the term
      setTimeout(() => {
        document.getElementById(`glossary-term-${found.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else {
      window.location.href = `/glossario/${slug}`;
    }
  }, [terms]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <GlossarySearch onSearch={handleSearch} />

      {/* Filters */}
      <div className="space-y-3">
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

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <span className="ml-2 text-ink-muted">Carregando glossário...</span>
        </div>
      ) : terms.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-[6px] border-2 border-border-subtle">
          <BookOpen className="h-12 w-12 text-ink-muted mx-auto mb-3" />
          <p className="text-ink-muted">
            {searchQuery
              ? `Nenhum termo encontrado para "${searchQuery}"`
              : 'Nenhum termo para os filtros selecionados'}
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-ink-muted">
            {terms.length} de {pagination.total} {pagination.total === 1 ? 'termo' : 'termos'}
            {searchQuery && ` para "${searchQuery}"`}
            {activeLetter && ` — letra "${activeLetter}"`}
            {activeCategory && ` — ${activeCategory}`}
          </div>

          <div className="bg-white rounded-[6px] border-2 border-border-subtle divide-y divide-border-subtle overflow-hidden">
            {terms.map((term) => (
              <div key={term.id} id={`glossary-term-${term.id}`}>
                <GlossaryTermCard
                  term={term}
                  isExpanded={expandedTermId === term.id}
                  onToggle={() => setExpandedTermId(expandedTermId === term.id ? null : term.id)}
                  onTermClick={handleTermClick}
                  articleBasePath={articleBasePath}
                />
              </div>
            ))}
          </div>

          {pagination.hasMore && (
            <div className="flex justify-center pt-3">
              <button
                type="button"
                onClick={() => void fetchTerms(pagination.page + 1, true)}
                disabled={loadingMore}
                className="inline-flex min-w-40 items-center justify-center rounded-md border border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
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
  );
}
