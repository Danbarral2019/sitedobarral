'use client';

import { useState, useEffect, useCallback } from 'react';
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
  leiArticles?: string | null;
  relatedTerms?: string | null;
}

export default function GlossarioPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [filteredTerms, setFilteredTerms] = useState<GlossaryTerm[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);

  // Buscar todos os termos ao carregar
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

  // Buscar termos (com debounce já implementado no componente)
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      // Se não há busca, aplicar filtros normais
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

  // Aplicar filtros (letra e categoria)
  const applyFilters = useCallback((
    termsList: GlossaryTerm[],
    letter: string | null,
    category: string | null
  ) => {
    let filtered = [...termsList];

    if (letter) {
      filtered = filtered.filter(t => t.term.toUpperCase().startsWith(letter));
    }

    if (category) {
      filtered = filtered.filter(t => t.category === category);
    }

    setFilteredTerms(filtered);
  }, []);

  // Handler para letra
  const handleLetterClick = useCallback((letter: string | null) => {
    setActiveLetter(letter);
    setSearchQuery('');
    applyFilters(terms, letter, activeCategory);
  }, [terms, activeCategory, applyFilters]);

  // Handler para categoria
  const handleCategoryChange = useCallback((category: string | null) => {
    setActiveCategory(category);
    setSearchQuery('');
    applyFilters(terms, activeLetter, category);
  }, [terms, activeLetter, applyFilters]);

  // Calcular letras disponíveis
  const availableLetters = Array.from(
    new Set(terms.map(t => t.term.charAt(0).toUpperCase()))
  ).sort();

  return (
    <div className="min-h-screen bg-surface-raised">
      {/* Hero Section */}
      <div className="bg-surface-raised text-ink-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <BookOpen className="h-16 w-16" />
            </div>
            <h1 className="text-4xl font-bold mb-4 font-cinzel">
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

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <span className="ml-2 text-ink-secondary">Carregando termos...</span>
          </div>
        ) : filteredTerms.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-ink-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-ink-primary mb-2">
              Nenhum termo encontrado
            </h3>
            <p className="text-ink-secondary">
              {searchQuery
                ? `Não encontramos termos para "${searchQuery}"`
                : 'Não há termos para os filtros selecionados'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-ink-secondary">
              Exibindo {filteredTerms.length} {filteredTerms.length === 1 ? 'termo' : 'termos'}
              {searchQuery && ` para "${searchQuery}"`}
              {activeLetter && ` começando com "${activeLetter}"`}
              {activeCategory && ` na categoria "${activeCategory}"`}
            </div>

            <div className="bg-surface-page rounded-md border border-border-subtle divide-y divide-border-subtle">
              {filteredTerms.map((term) => (
                <GlossaryTermCard
                  key={term.id}
                  term={term}
                  isExpanded={expandedTermId === term.id}
                  onToggle={() => setExpandedTermId(expandedTermId === term.id ? null : term.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
