'use client';

import { useState, useEffect, useCallback } from 'react';
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
  leiArticles?: string | null;
  relatedTerms?: string | null;
  resolvedRelatedTerms?: { id: string; term: string; slug: string }[];
}

interface GlossaryPanelProps {
  articleBasePath?: string;
}

export function GlossaryPanel({ articleBasePath = '/area-restrita/artigo' }: GlossaryPanelProps) {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [filteredTerms, setFilteredTerms] = useState<GlossaryTerm[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/glossary');
      const data = await response.json();
      setTerms(data.terms || []);
      setFilteredTerms(data.terms || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Erro ao buscar termos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      applyFilters(terms, activeLetter, activeCategory);
      return;
    }
    try {
      const response = await fetch(`/api/glossary/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setFilteredTerms(data.terms || []);
    } catch (error) {
      console.error('Erro ao buscar:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terms, activeLetter, activeCategory]);

  const applyFilters = useCallback((
    termsList: GlossaryTerm[],
    letter: string | null,
    category: string | null
  ) => {
    let filtered = [...termsList];
    if (letter) filtered = filtered.filter(t => t.term.toUpperCase().startsWith(letter));
    if (category) filtered = filtered.filter(t => t.category === category);
    setFilteredTerms(filtered);
  }, []);

  const handleLetterClick = useCallback((letter: string | null) => {
    setActiveLetter(letter);
    setSearchQuery('');
    applyFilters(terms, letter, activeCategory);
  }, [terms, activeCategory, applyFilters]);

  const handleCategoryChange = useCallback((category: string | null) => {
    setActiveCategory(category);
    setSearchQuery('');
    applyFilters(terms, activeLetter, category);
  }, [terms, activeLetter, applyFilters]);

  const handleTermClick = useCallback((slug: string) => {
    const found = terms.find(t => t.slug === slug);
    if (found) {
      setExpandedTermId(found.id);
      // Scroll to the term
      setTimeout(() => {
        document.getElementById(`glossary-term-${found.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [terms]);

  const availableLetters = Array.from(
    new Set(terms.map(t => t.term.charAt(0).toUpperCase()))
  ).sort();

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
      ) : filteredTerms.length === 0 ? (
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
            {filteredTerms.length} {filteredTerms.length === 1 ? 'termo' : 'termos'}
            {searchQuery && ` para "${searchQuery}"`}
            {activeLetter && ` — letra "${activeLetter}"`}
            {activeCategory && ` — ${activeCategory}`}
          </div>

          <div className="bg-white rounded-[6px] border-2 border-border-subtle divide-y divide-border-subtle overflow-hidden">
            {filteredTerms.map((term) => (
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
        </>
      )}
    </div>
  );
}
