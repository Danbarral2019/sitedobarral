'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ===========================
// Types
// ===========================

// Base interface for all search results
interface BaseSearchResult {
  id: string;
  title: string;
  description?: string;
  url?: string;
  resultType: 'document' | 'article';
}

// Document-specific fields
export interface DocumentSearchResult extends BaseSearchResult {
  resultType: 'document';
  type: string; // pdf, doc, link, video
  category: string;
  uploadedAt?: string;
  tags?: string;
  courseIds?: string[];
}

// Article-specific fields (Lei 14.133)
export interface ArticleSearchResult extends BaseSearchResult {
  resultType: 'article';
  numero: string;
  capitulo: string;
  secao?: string;
}

// Union type for all search results
export type UnifiedSearchResult = DocumentSearchResult | ArticleSearchResult;

export type SearchType = 'local' | 'ai' | null;

export interface SearchState {
  query: string;
  timestamp: Date | null;
  results: UnifiedSearchResult[];
  searchType: SearchType;
  aiResponse: string | null;
  relevanceScores: Record<string, number>;
  isLoading: boolean;
}

interface SearchContextValue {
  searchState: SearchState;
  setLocalSearch: (query: string, results: UnifiedSearchResult[]) => void;
  setAISearch: (
    query: string,
    results: UnifiedSearchResult[],
    aiResponse: string,
    relevanceScores: Record<string, number>
  ) => void;
  clearSearch: () => void;
  setLoading: (loading: boolean) => void;
}

// ===========================
// Context
// ===========================

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

// ===========================
// Provider
// ===========================

const initialState: SearchState = {
  query: '',
  timestamp: null,
  results: [],
  searchType: null,
  aiResponse: null,
  relevanceScores: {},
  isLoading: false,
};

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchState, setSearchState] = useState<SearchState>(initialState);

  const setLocalSearch = useCallback((query: string, results: UnifiedSearchResult[]) => {
    setSearchState({
      query,
      timestamp: new Date(),
      results,
      searchType: 'local',
      aiResponse: null,
      relevanceScores: {},
      isLoading: false,
    });
  }, []);

  const setAISearch = useCallback(
    (
      query: string,
      results: UnifiedSearchResult[],
      aiResponse: string,
      relevanceScores: Record<string, number>
    ) => {
      setSearchState({
        query,
        timestamp: new Date(),
        results,
        searchType: 'ai',
        aiResponse,
        relevanceScores,
        isLoading: false,
      });
    },
    []
  );

  const clearSearch = useCallback(() => {
    setSearchState(initialState);
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setSearchState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  return (
    <SearchContext.Provider
      value={{
        searchState,
        setLocalSearch,
        setAISearch,
        clearSearch,
        setLoading,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

// ===========================
// Hook
// ===========================

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
}
