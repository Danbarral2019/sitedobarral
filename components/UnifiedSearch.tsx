'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, SlidersHorizontal, Loader2, Sparkles, AlertCircle, FileText, Scale } from 'lucide-react';
import { SearchScope } from '@/hooks/use-search';
import { useSearchContext, type DocumentSearchResult, type UnifiedSearchResult } from '@/contexts/SearchContext';

interface UnifiedSearchProps {
  // Local search props
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  scope: SearchScope;
  onScopeToggle: () => void;
  onFiltersClick: () => void;
  activeFiltersCount: number;
  resultsCount?: number;
  currentCourseName?: string;

  // Documents for AI search
  allDocuments: DocumentSearchResult[];
  currentCourseId?: string;
}

export default function UnifiedSearch({
  value,
  onChange,
  onClear,
  scope,
  onScopeToggle,
  onFiltersClick,
  activeFiltersCount,
  resultsCount,
  currentCourseName,
  allDocuments,
  currentCourseId,
}: UnifiedSearchProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [aiError, setAiError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { searchState, setLocalSearch, setAISearch, setLoading } = useSearchContext();

  // Debounce do input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(debouncedValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [debouncedValue, onChange]);

  // Update local search in context when value changes
  useEffect(() => {
    if (value && resultsCount !== undefined) {
      // Filter documents that match current search
      const filteredDocs = allDocuments.filter(doc => {
        const searchLower = value.toLowerCase();
        const matchesSearch =
          doc.title.toLowerCase().includes(searchLower) ||
          doc.description?.toLowerCase().includes(searchLower) ||
          doc.tags?.toLowerCase().includes(searchLower);

        const matchesScope = scope === 'all' || doc.courseIds?.includes(currentCourseId || '');

        return matchesSearch && matchesScope;
      });

      setLocalSearch(value, filteredDocs);
    }
  }, [value, resultsCount, allDocuments, scope, currentCourseId, setLocalSearch]);

  const handleClear = () => {
    setDebouncedValue('');
    onClear();
    setAiError(null);
    inputRef.current?.focus();
  };

  const handleAISearch = async () => {
    if (!value.trim()) return;

    setLoading(true);
    setAiError(null);

    try {
      const response = await fetch('/api/search/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: value,
          filters: {
            courseId: scope === 'current' ? currentCourseId : undefined,
            resultType: 'all', // Search both documents and articles
          },
          maxResults: 10,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao buscar');
      }

      const data = await response.json();

      // Map API results to unified search result format
      const aiResults: UnifiedSearchResult[] = data.results.map((result: any) => {
        if (result.resultType === 'article') {
          // Article result
          return {
            resultType: 'article' as const,
            id: result.id,
            title: result.title,
            description: result.description,
            url: result.url,
            numero: result.numero,
            capitulo: result.capitulo,
            secao: result.secao,
          };
        } else {
          // Document result
          return {
            resultType: 'document' as const,
            id: result.id,
            title: result.title,
            description: result.description,
            type: 'document',
            category: result.category,
            url: result.url,
            uploadedAt: result.uploadedAt,
            tags: result.tags?.join(', '),
            courseIds: result.courseIds,
          };
        }
      });

      // Build relevance scores map
      const relevanceScores: Record<string, number> = {};
      data.results.forEach((result: any) => {
        relevanceScores[result.id] = result.relevance;
      });

      // Get AI response summary
      const breakdown = data.breakdown;
      const aiResponse = data.results.length > 0
        ? `Encontrei ${data.results.length} resultado(s): ${breakdown.documents} documento(s) e ${breakdown.articles} artigo(s) da Lei 14.133/2021.`
        : 'Não encontrei resultados para sua consulta.';

      setAISearch(value, aiResults, aiResponse, relevanceScores);
    } catch (error) {
      console.error('Unified search error:', error);
      setAiError(error instanceof Error ? error.message : 'Erro ao buscar');
      setLoading(false);
    }
  };

  const isSearching = searchState.isLoading;
  const hasLocalResults = value && resultsCount && resultsCount > 0;
  const isAISearch = searchState.searchType === 'ai' && searchState.query === value;

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-lg sticky top-0 z-30 p-3 lg:p-4 mb-4">
      {/* Search Type Indicator */}
      {searchState.searchType && searchState.query === value && (
        <div className={`mb-3 px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${
          searchState.searchType === 'ai'
            ? 'bg-purple-50 text-purple-700 border border-purple-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {searchState.searchType === 'ai' ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">Busca Semântica com IA</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span className="font-medium">Busca Local (instantânea)</span>
            </>
          )}
        </div>
      )}

      {/* AI Response Box */}
      {isAISearch && searchState.aiResponse && (
        <div className="mb-3 p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-700 leading-relaxed">{searchState.aiResponse}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {aiError && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{aiError}</p>
            <button
              onClick={() => setAiError(null)}
              className="text-xs text-red-600 hover:text-red-700 underline mt-1"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Main Search Bar */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Search Icon */}
        <div className="flex-shrink-0">
          {isSearching ? (
            <Loader2 className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600 animate-spin" />
          ) : (
            <Search className="w-5 h-5 lg:w-6 lg:h-6 text-gray-400" />
          )}
        </div>

        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          value={debouncedValue}
          onChange={(e) => setDebouncedValue(e.target.value)}
          placeholder="Buscar documentos, acórdãos, pareceres..."
          className="flex-1 text-sm lg:text-base text-gray-900 placeholder-gray-400 focus:outline-none min-w-0"
        />

        {/* Clear Button */}
        {debouncedValue && (
          <button
            onClick={handleClear}
            className="flex-shrink-0 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Limpar busca"
          >
            <X className="w-4 h-4 lg:w-5 lg:h-5 text-gray-500" />
          </button>
        )}

        {/* Filters Button */}
        <button
          onClick={onFiltersClick}
          className="flex-shrink-0 relative px-3 py-2 lg:px-4 lg:py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
          title="Filtros avançados"
        >
          <SlidersHorizontal className="w-4 h-4 lg:w-5 lg:h-5 text-gray-700" />
          <span className="hidden sm:inline text-sm font-medium text-gray-700">
            Filtros
          </span>
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Bottom Controls: Scope + AI Button + Results Count */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 gap-2">
        {/* Scope Toggle */}
        <button
          onClick={onScopeToggle}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className={`w-10 h-5 rounded-full relative transition-colors ${
            scope === 'all' ? 'bg-blue-600' : 'bg-gray-300'
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              scope === 'all' ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </div>
          <span className="text-xs lg:text-sm font-medium text-gray-700">
            {scope === 'current'
              ? `Apenas: ${currentCourseName || 'este curso'}`
              : 'Todos os cursos'
            }
          </span>
        </button>

        {/* AI Search Button (only show if has local results and not already AI search) */}
        {hasLocalResults && !isAISearch && !isSearching && (
          <button
            onClick={handleAISearch}
            disabled={isSearching}
            className="px-3 py-1.5 lg:px-4 lg:py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all flex items-center gap-2 text-xs lg:text-sm font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Buscar com IA para análise semântica profunda"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Buscar com IA</span>
            <span className="sm:hidden">IA</span>
          </button>
        )}

        {/* Results Count */}
        {(value || activeFiltersCount > 0) && resultsCount !== undefined && (
          <div className="text-xs lg:text-sm text-gray-600 font-medium">
            {resultsCount === 0 ? (
              <span className="text-orange-600">Nenhum resultado</span>
            ) : resultsCount === 1 ? (
              <span className="text-green-600">1 resultado</span>
            ) : (
              <span className="text-green-600">{resultsCount} resultados</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
