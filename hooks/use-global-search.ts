'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ContentType,
  GlobalSearchResponse,
  GlobalSearchFilters,
  SearchResultItem,
} from '@/lib/types/global-search';

export interface LegalSource {
  type: 'lei-article' | 'legislative-act';
  title: string;
  url: string;
  articleNumber?: string;
}

export interface AISource {
  documentId: string;
  title: string;
  category: string;
  relevance: number;
  excerpt: string;
  url?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UseGlobalSearchOptions {
  debounceMs?: number;
  aiDebounceMs?: number;
  minQueryLength?: number;
  initialFilters?: Partial<GlobalSearchFilters>;
}

/**
 * Snapshot serializável do estado da última busca — usado para restaurar a
 * tela ao voltar de /documento/[id] sem ter que rodar a busca de novo. Salvo
 * em sessionStorage pela página que consome o hook.
 */
export interface SearchSnapshot {
  query: string;
  results: SearchResultItem[];
  counts: GlobalSearchResponse['counts'];
  aiAnswer: string | null;
  aiSources: AISource[];
  aiLegalSources: LegalSource[];
  aiConversationHistory: ConversationMessage[];
  ticMode: boolean;
  savedAt: number; // epoch ms — para TTL
}

interface UseGlobalSearchReturn {
  // State
  query: string;
  results: SearchResultItem[];
  counts: GlobalSearchResponse['counts'];
  isLoading: boolean;
  error: string | null;
  isSearchActive: boolean;

  // AI State
  aiAnswer: string | null;
  aiSources: AISource[];
  aiLegalSources: LegalSource[];
  isAiLoading: boolean;
  aiError: string | null;
  aiEnabled: boolean;
  setAiEnabled: (enabled: boolean) => void;

  // TIC Mode
  ticMode: boolean;
  setTicMode: (enabled: boolean) => void;

  // Conversation
  aiConversationHistory: ConversationMessage[];
  sendFollowUp: (followUpQuery: string) => void;

  // Filters
  filters: GlobalSearchFilters;
  updateFilters: (newFilters: Partial<GlobalSearchFilters>) => void;
  clearFilters: () => void;

  // Actions
  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  triggerAISearch: () => void;
  // Restaura snapshot completo (query + resultados + IA) sem refetch.
  // Cancela qualquer busca em curso. Usado pelo consumidor pra recuperar
  // estado de sessionStorage ao voltar de outra rota.
  restoreSnapshot: (snapshot: SearchSnapshot) => void;

  // Type toggles
  toggleType: (type: ContentType) => void;
  isTypeActive: (type: ContentType) => boolean;
}

const DEFAULT_FILTERS: GlobalSearchFilters = {
  types: ['document', 'lei', 'glossary', 'faq', 'video', 'blog', 'site', 'legislative-act'],
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
  blog: 0,
  site: 0,
  'legislative-act': 0,
  total: 0,
};

export function useGlobalSearch(options: UseGlobalSearchOptions = {}): UseGlobalSearchReturn {
  const { debounceMs = 300, aiDebounceMs = 1500, minQueryLength = 2, initialFilters = {} } = options;

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

  // AI State
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiSources, setAiSources] = useState<AISource[]>([]);
  const [aiLegalSources, setAiLegalSources] = useState<LegalSource[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [ticMode, setTicMode] = useState(false);
  const [aiConversationHistory, setAiConversationHistory] = useState<ConversationMessage[]>([]);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const aiDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiConversationHistoryRef = useRef<ConversationMessage[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    aiConversationHistoryRef.current = aiConversationHistory;
  }, [aiConversationHistory]);

  // Computed
  const isSearchActive = query.length >= minQueryLength;

  // AI Search function
  const searchAI = useCallback(
    async (searchQuery: string, history?: ConversationMessage[]) => {
      // Cancel previous AI request
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
      }

      if (searchQuery.length < minQueryLength) {
        setAiAnswer(null);
        setAiSources([]);
        setAiLegalSources([]);
        setIsAiLoading(false);
        return;
      }

      setIsAiLoading(true);
      setAiError(null);

      const controller = new AbortController();
      aiAbortControllerRef.current = controller;

      try {
        const requestBody: Record<string, unknown> = {
          query: searchQuery,
          maxResults: 30,
          useCache: true,
          filters: ticMode ? { ticMode: true } : undefined,
        };

        // Include conversation history if provided (use ref to avoid stale closure)
        const historyToSend = history || aiConversationHistoryRef.current;
        if (historyToSend.length > 0) {
          requestBody.conversationHistory = historyToSend.slice(-5);
        }

        requestBody.stream = true;

        const response = await fetch('/api/documents/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (response.status === 429) {
          if (!controller.signal.aborted) {
            setAiError('Limite de consultas atingido. Aguarde um momento e tente novamente.');
            setAiAnswer(null);
            setAiSources([]);
            setAiLegalSources([]);
          }
          return;
        }

        if (!response.ok) {
          throw new Error('Falha na busca com IA');
        }

        // Read SSE stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullAnswer = '';
        let streamSources: AISource[] = [];
        let streamLegalSources: LegalSource[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'meta') {
                streamSources = (parsed.results || []).map((r: AISource) => ({
                  documentId: r.documentId,
                  title: r.title,
                  category: r.category,
                  relevance: r.relevance,
                  excerpt: r.excerpt,
                  url: r.url,
                }));
                streamLegalSources = parsed.legalSources || [];
                if (!controller.signal.aborted) {
                  setAiSources(streamSources);
                  setAiLegalSources(streamLegalSources);
                }
              } else if (parsed.type === 'token') {
                fullAnswer += parsed.text;
                if (!controller.signal.aborted) {
                  setAiAnswer(fullAnswer);
                }
              }
            } catch { /* ignore parse errors */ }
          }
        }

        if (!controller.signal.aborted) {
          const answer = fullAnswer || null;
          setAiAnswer(answer);

          // Update conversation history
          if (answer) {
            setAiConversationHistory(prev => [
              ...prev,
              { role: 'user' as const, content: searchQuery },
              { role: 'assistant' as const, content: answer },
            ]);

            // Save to search history (fire-and-forget). Persistimos os
            // filtros ativos pra reproduzir a busca exatamente no eval do
            // golden set e para analytics por filtro.
            fetch('/api/area-restrita/search-history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'documents',
                query: searchQuery,
                aiAnswer: answer,
                filters: {
                  types: filters.types,
                  ticMode,
                },
                sources: streamSources.map((r: AISource) => ({
                  title: r.title,
                  category: r.category,
                  url: r.url,
                })),
                legalSources: streamLegalSources,
              }),
            }).catch(() => {}); // Silently ignore errors
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          if (!controller.signal.aborted) {
            setAiError(err.message);
            setAiAnswer(null);
            setAiSources([]);
            setAiLegalSources([]);
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsAiLoading(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minQueryLength, ticMode]
  );

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

  // Trigger AI search immediately (e.g. on Enter)
  const triggerAISearch = useCallback(() => {
    if (!aiEnabled || query.length < minQueryLength) return;

    // Cancel pending AI debounce
    if (aiDebounceTimerRef.current) {
      clearTimeout(aiDebounceTimerRef.current);
      aiDebounceTimerRef.current = null;
    }

    searchAI(query);
  }, [aiEnabled, query, minQueryLength, searchAI]);

  // Send a follow-up question using conversation history
  const sendFollowUp = useCallback(
    (followUpQuery: string) => {
      if (!aiEnabled || followUpQuery.length < minQueryLength) return;
      searchAI(followUpQuery);
    },
    [aiEnabled, minQueryLength, searchAI]
  );

  // Debounced query change
  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);

      // Clear previous debounce timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (aiDebounceTimerRef.current) {
        clearTimeout(aiDebounceTimerRef.current);
      }

      // If query is empty, clear results immediately
      if (!newQuery.trim()) {
        setResults([]);
        setCounts(DEFAULT_COUNTS);
        setIsLoading(false);
        setAiAnswer(null);
        setAiSources([]);
        setAiLegalSources([]);
        setIsAiLoading(false);
        setAiError(null);
        setAiConversationHistory([]);
        if (aiAbortControllerRef.current) {
          aiAbortControllerRef.current.abort();
        }
        return;
      }

      // Set loading state immediately for UX
      if (newQuery.length >= minQueryLength) {
        setIsLoading(true);
      }

      // Debounce the text search (300ms)
      debounceTimerRef.current = setTimeout(() => {
        search(newQuery);
      }, debounceMs);

      // Debounce the AI search (1500ms)
      if (aiEnabled && newQuery.length >= minQueryLength) {
        setIsAiLoading(true);
        aiDebounceTimerRef.current = setTimeout(() => {
          searchAI(newQuery);
        }, aiDebounceMs);
      }
    },
    [debounceMs, aiDebounceMs, minQueryLength, search, searchAI, aiEnabled]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (aiDebounceTimerRef.current) {
      clearTimeout(aiDebounceTimerRef.current);
    }
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    setQueryState('');
    setResults([]);
    setCounts(DEFAULT_COUNTS);
    setError(null);
    setIsLoading(false);
    setAiAnswer(null);
    setAiSources([]);
    setAiLegalSources([]);
    setAiError(null);
    setIsAiLoading(false);
    setAiConversationHistory([]);
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

  // Restaura estado completo a partir de snapshot — sem disparar fetch nem
  // debounce. Usado pelo consumidor pra recuperar busca após voltar de outra
  // rota, evitando re-rodar a busca IA (que demora 2-5s).
  const restoreSnapshot = useCallback((snapshot: SearchSnapshot) => {
    // Cancela tudo em curso pra evitar overwrite do snapshot.
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (aiDebounceTimerRef.current) clearTimeout(aiDebounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();

    setQueryState(snapshot.query);
    setResults(snapshot.results);
    setCounts(snapshot.counts);
    setIsLoading(false);
    setError(null);
    setAiAnswer(snapshot.aiAnswer);
    setAiSources(snapshot.aiSources);
    setAiLegalSources(snapshot.aiLegalSources);
    setIsAiLoading(false);
    setAiError(null);
    setAiConversationHistory(snapshot.aiConversationHistory);
    setTicMode(snapshot.ticMode);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (aiDebounceTimerRef.current) {
        clearTimeout(aiDebounceTimerRef.current);
      }
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
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

    // AI State
    aiAnswer,
    aiSources,
    aiLegalSources,
    isAiLoading,
    aiError,
    aiEnabled,
    setAiEnabled,

    // TIC Mode
    ticMode,
    setTicMode,

    // Conversation
    aiConversationHistory,
    sendFollowUp,

    // Filters
    filters,
    updateFilters,
    clearFilters,

    // Actions
    setQuery,
    search,
    clearSearch,
    triggerAISearch,
    restoreSnapshot,

    // Type toggles
    toggleType,
    isTypeActive,
  };
}
