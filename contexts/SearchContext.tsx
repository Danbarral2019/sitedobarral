'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ===========================
// Types
// ===========================

export interface DocumentSearchResult {
  id: string;
  title: string;
  description?: string;
  type: string;
  url?: string;
  category: string;
  uploadedAt?: string;
  tags?: string;
  courseIds?: string[];
}

export type SearchType = 'local' | 'ai' | null;

export interface SearchState {
  query: string;
  timestamp: Date | null;
  results: DocumentSearchResult[];
  searchType: SearchType;
  aiResponse: string | null;
  relevanceScores: Record<string, number>;
  isLoading: boolean;
}

interface SearchContextValue {
  searchState: SearchState;
  setLocalSearch: (query: string, results: DocumentSearchResult[]) => void;
  setAISearch: (
    query: string,
    results: DocumentSearchResult[],
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

  const setLocalSearch = useCallback((query: string, results: DocumentSearchResult[]) => {
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
      results: DocumentSearchResult[],
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
