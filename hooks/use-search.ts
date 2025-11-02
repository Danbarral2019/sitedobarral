'use client';

import { useState, useCallback, useMemo } from 'react';

export type DocumentType = {
  id: string;
  title: string;
  description?: string;
  content?: string; // Conteúdo/trechos relevantes para busca textual
  type: string;
  category: string;
  courseId?: string;
  tags?: string;
  leiArticles?: string; // JSON array com números de artigos da Lei 14.133/2021
  uploadedAt?: string;
  url?: string;
};

export type GlossaryTermType = {
  id: string;
  term: string;
  slug: string;
  definition: string;
  shortDef?: string | null;
  category?: string | null;
  viewCount: number;
};

export type SearchFilters = {
  courseIds: string[];
  categories: string[];
  types: string[];
  leiArticles: string[]; // Números de artigos da Lei 14.133/2021
  dateRange: 'all' | '7days' | '30days' | '90days' | 'custom';
  customDateStart?: Date;
  customDateEnd?: Date;
  favoritesOnly: boolean;
  sortBy: 'relevance' | 'newest' | 'oldest' | 'az' | 'za';
};

export type SearchScope = 'current' | 'all';

const DEFAULT_FILTERS: SearchFilters = {
  courseIds: [],
  categories: [],
  types: [],
  leiArticles: [],
  dateRange: 'all',
  favoritesOnly: false,
  sortBy: 'relevance',
};

export function useSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [scope, setScope] = useState<SearchScope>('current');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    clearFilters();
  }, [clearFilters]);

  const toggleScope = useCallback(() => {
    setScope(prev => prev === 'current' ? 'all' : 'current');
  }, []);

  // Conta quantos filtros ativos existem
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.courseIds.length > 0) count++;
    if (filters.categories.length > 0) count++;
    if (filters.types.length > 0) count++;
    if (filters.leiArticles.length > 0) count++;
    if (filters.dateRange !== 'all') count++;
    if (filters.favoritesOnly) count++;
    if (filters.sortBy !== 'relevance') count++;
    return count;
  }, [filters]);

  // Verifica se há busca/filtros ativos
  const isSearchActive = useMemo(() => {
    return searchTerm.length > 0 || activeFiltersCount > 0;
  }, [searchTerm, activeFiltersCount]);

  return {
    searchTerm,
    setSearchTerm,
    filters,
    updateFilters,
    clearFilters,
    clearSearch,
    scope,
    setScope,
    toggleScope,
    isFiltersOpen,
    setIsFiltersOpen,
    activeFiltersCount,
    isSearchActive,
  };
}
