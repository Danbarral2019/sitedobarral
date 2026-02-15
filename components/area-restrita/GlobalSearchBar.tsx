'use client';

import { useRef, useEffect } from 'react';
import {
  Search,
  X,
  Loader2,
  FileText,
  Scale,
  BookOpen,
  Video,
  Globe,
  Sparkles,
  SlidersHorizontal,
  Gavel,
  HelpCircle,
  Newspaper,
} from 'lucide-react';
import type { ContentType, GlobalSearchResponse } from '@/lib/types/global-search';
import { CONTENT_TYPE_CONFIG } from '@/lib/types/global-search';
import { trackClientEvent } from '@/lib/monitoring/track-client';

interface GlobalSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  isLoading: boolean;
  counts: GlobalSearchResponse['counts'];
  activeTypes: ContentType[];
  onToggleType: (type: ContentType) => void;
  onFiltersClick?: () => void;
  aiEnabled: boolean;
  onAIToggle: () => void;
  isAiLoading: boolean;
  onSubmit: () => void;
  placeholder?: string;
}

const TYPE_ICONS: Record<ContentType, typeof FileText> = {
  document: FileText,
  'course-material': BookOpen,
  lei: Scale,
  glossary: BookOpen,
  faq: HelpCircle,
  video: Video,
  blog: Newspaper,
  site: Globe,
  'legislative-act': Gavel,
};

export function GlobalSearchBar({
  query,
  onQueryChange,
  onClear,
  isLoading,
  counts,
  activeTypes,
  onToggleType,
  onFiltersClick,
  aiEnabled,
  onAIToggle,
  isAiLoading,
  onSubmit,
  placeholder = 'Buscar em todo o acervo...',
}: GlobalSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => {
    // Don't auto-focus on mobile
    if (window.innerWidth >= 1024) {
      inputRef.current?.focus();
    }
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to clear and blur
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        if (query) {
          onClear();
        } else {
          inputRef.current?.blur();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [query, onClear]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      trackClientEvent('search_performed', { query_length: query.length, ai_enabled: aiEnabled });
      onSubmit();
    }
  };

  const hasResults = counts.total > 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Search Input Row */}
      <div className="flex items-center gap-2 p-4">
        {/* Search Icon / Loading Indicator */}
        <div className="flex-shrink-0">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className="flex-1 text-base outline-none placeholder:text-gray-400 text-gray-900"
        />

        {/* Right side buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Clear button */}
          {query && (
            <button
              onClick={onClear}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* AI Toggle Button */}
          <button
            onClick={onAIToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
              aiEnabled
                ? 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200'
                : 'text-gray-400 bg-gray-50 hover:bg-gray-100 border-gray-200'
            }`}
            title={aiEnabled ? 'Desativar busca com IA' : 'Ativar busca com IA'}
          >
            {isAiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">IA</span>
          </button>

          {/* Filters Button */}
          {onFiltersClick && (
            <button
              onClick={onFiltersClick}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Type Filters Row */}
      <div className="flex items-center gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
        {(Object.keys(CONTENT_TYPE_CONFIG) as ContentType[]).map((type) => {
          const config = CONTENT_TYPE_CONFIG[type];
          const Icon = TYPE_ICONS[type] || FileText;
          const isActive = activeTypes.includes(type);
          const count = counts[type];

          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? `${config.bgColor} ${config.color} ${config.borderColor} border`
                  : 'text-gray-500 bg-gray-50 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{config.labelPlural}</span>
              {query && hasResults && (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-white/50' : 'bg-gray-200'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Results summary */}
      {query && hasResults && (
        <div className="px-4 pb-3 text-sm text-gray-600 border-t border-gray-100 pt-3">
          <span className="font-medium text-gray-900">{counts.total}</span> resultados encontrados
          para <span className="font-medium text-brand-600">&quot;{query}&quot;</span>
        </div>
      )}

      {/* No results message */}
      {query && query.length >= 2 && !isLoading && counts.total === 0 && (
        <div className="px-4 pb-3 text-sm text-gray-500 border-t border-gray-100 pt-3">
          Nenhum resultado encontrado para &quot;{query}&quot;
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
