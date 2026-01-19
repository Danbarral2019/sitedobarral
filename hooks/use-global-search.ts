'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ContentType,
  GlobalSearchResponse,
  GlobalSearchFilters,
  SearchResultItem,
} from '@/lib/types/global-search';

interface UseGlobalSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  initialFilters?: Partial<GlobalSearchFilters>;
}

interface UseGlobalSearchReturn {
  // State
  query: string;
  results: SearchResultItem[];
  counts: GlobalSearchResponse['counts'];
  isLoading: boolean;
  error: string | null;
  isSearchActive: boolean;

  // Filters
  filters: GlobalSearchFilters;
  updateFilters: (newFilters: Partial<GlobalSearchFilters>) => void;
  clearFilters: () => void;

  // Actions
  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Type toggles
  toggleType: (type: ContentType) => void;
  isTypeActive: (type: ContentType) => boolean;
}

const DEFAULT_FILTERS: GlobalSearchFilters = {
  types: ['document', 'lei', 'glossary', 'faq', 'video', 'site'],
  courseIds: [],
  categories: [],
  dateRange: 'all',
};

const DEFAULT_COUNTS: GlobalSearchResponse['counts'] = {
  document: 0,
  lei: 0,
  glossary: 0,
  faq: 0,
  video: 0,
  site: 0,
  total: 0,
};

export function useGlobalSearch(options: UseGlobalSearchOptions = {}): UseGlobalSearchReturn {
  const { debounceMs = 300, minQueryLength = 2, initialFilters = {} } = options;

  // State
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [counts, setCounts] = useState<GlobalSearchResponse['counts']>(DEFAULT_COUNTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GlobalSearchFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Computed
  const isSearchActive = query.length >= minQueryLength;

  // Search function
  const search = useCallback(
    async (searchQuery: string) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Skip if query is too short
      if (searchQuery.length < minQueryLength) {
        setResults([]);
        setCounts(DEFAULT_COUNTS);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const params = new URLSearchParams({
          q: searchQuery,
          types: filters.types.join(','),
        });

        const response = await fetch(`/api/area-restrita/global-search?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data: GlobalSearchResponse = await response.json();

        // Only update if this is still the current request
        if (!controller.signal.aborted) {
          setResults(data.results);
          setCounts(data.counts);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
          setResults([]);
          setCounts(DEFAULT_COUNTS);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [filters.types, minQueryLength]
  );

  // Debounced query change
  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // If query is empty, clear results immediately
      if (!newQuery.trim()) {
        setResults([]);
        setCounts(DEFAULT_COUNTS);
        setIsLoading(false);
        return;
      }

      // Set loading state immediately for UX
      if (newQuery.length >= minQueryLength) {
        setIsLoading(true);
      }

      // Debounce the search
      debounceTimerRef.current = setTimeout(() => {
        search(newQuery);
      }, debounceMs);
    },
    [debounceMs, minQueryLength, search]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setQueryState('');
    setResults([]);
    setCounts(DEFAULT_COUNTS);
    setError(null);
    setIsLoading(false);
  }, []);

  // Filter management
  const updateFilters = useCallback(
    (newFilters: Partial<GlobalSearchFilters>) => {
      setFilters((prev) => {
        const updated = { ...prev, ...newFilters };
        // Re-search with new filters if there's an active query
        if (query.length >= minQueryLength) {
          // Use timeout to avoid state update in render
          setTimeout(() => search(query), 0);
        }
        return updated;
      });
    },
    [query, minQueryLength, search]
  );

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    if (query.length >= minQueryLength) {
      setTimeout(() => search(query), 0);
    }
  }, [query, minQueryLength, search]);

  // Type toggle helpers
  const toggleType = useCallback(
    (type: ContentType) => {
      setFilters((prev) => {
        const newTypes = prev.types.includes(type)
          ? prev.types.filter((t) => t !== type)
          : [...prev.types, type];

        // Ensure at least one type is selected
        if (newTypes.length === 0) {
          return prev;
        }

        return { ...prev, types: newTypes };
      });
    },
    []
  );

  const isTypeActive = useCallback(
    (type: ContentType) => {
      return filters.types.includes(type);
    },
    [filters.types]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    query,
    results,
    counts,
    isLoading,
    error,
    isSearchActive,

    // Filters
    filters,
    updateFilters,
    clearFilters,

    // Actions
    setQuery,
    search,
    clearSearch,

    // Type toggles
    toggleType,
    isTypeActive,
  };
}
