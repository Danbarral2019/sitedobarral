'use client';

import { useRef, useEffect } from 'react';
import {
  Search,
  X,
  Loader2,
  Sparkles,
  Monitor,
  Info,
} from 'lucide-react';
// `isLoading` (texto) é recebido por compatibilidade da prop mas o ícone do
// input NÃO troca por spinner — trocar a cada keystroke gerava o "leve
// piscar"relatado pelo usuário (2026-05-23). O feedback de loading vive nos
// skeletons da SearchResultsList e nos botões IA/Modo TIC.
import type { ContentType, GlobalSearchResponse } from '@/lib/types/global-search';
import { trackClientEvent } from '@/lib/monitoring/track-client';

interface GlobalSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  isLoading: boolean;
  counts: GlobalSearchResponse['counts'];
  // Mantidos por compatibilidade com o caller — mas a UI de chips foi removida
  // (o usuário raramente escolhia uma única fonte; resultados agrupados por
  // tipo na lista abaixo são mais úteis).
  activeTypes: ContentType[];
  onToggleType: (type: ContentType) => void;
  aiEnabled: boolean;
  onAIToggle: () => void;
  isAiLoading: boolean;
  onSubmit: () => void;
  placeholder?: string;
  ticMode?: boolean;
  onTicToggle?: () => void;
}

export function GlobalSearchBar({
  query,
  onQueryChange,
  onClear,
  // isLoading recebido mas não usado no ícone do input (ver comentário no topo).
  aiEnabled,
  onAIToggle,
  isAiLoading,
  onSubmit,
  placeholder = 'Buscar em todo o acervo...',
  ticMode = false,
  onTicToggle,
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

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-[6px] border border-border-subtle">
        {/* Search Input Row */}
        <div className="flex items-center gap-2 p-4">
          {/* Search Icon — fixo (não troca por spinner). Feedback de loading
              fica nos skeletons abaixo e nos botões IA/Modo TIC. */}
          <div className="flex-shrink-0">
            <Search className="w-5 h-5 text-ink-muted" />
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="flex-1 text-base outline-none placeholder:text-ink-muted text-ink-primary"
          />

          {/* Right side buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Clear button */}
            {query && (
              <button
                onClick={onClear}
                className="p-1.5 text-ink-muted hover:text-ink-secondary hover:bg-surface-deep rounded-[6px] transition-colors"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* AI Toggle Button */}
            <button
              onClick={onAIToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-[6px] transition-colors border ${
                aiEnabled
                  ? 'text-brand-700 bg-brand-50 hover:bg-brand-100 border-brand-200'
                  : 'text-ink-muted bg-surface-raised hover:bg-surface-deep border-border-subtle'
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
          </div>
        </div>
      </div>

      {/* Modo TIC — switch dedicado abaixo do campo */}
      {onTicToggle && (
        <div className="flex items-center justify-end gap-3 px-1">
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <Monitor className="w-4 h-4 text-ink-muted"aria-hidden="true" />
            Modo TIC
          </span>

          <button
            type="button"
            role="switch"
            aria-checked={ticMode}
            onClick={onTicToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
              ticMode ? 'bg-brand-600' : 'bg-border-strong'
            }`}
            aria-label={ticMode ? 'Desativar Modo TIC' : 'Ativar Modo TIC'}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                ticMode ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>

          <span
            className="inline-flex items-center text-ink-muted cursor-help"
            title="Ative para contratações de Tecnologia da Informação e Comunicação. A IA passa a consultar as INs e Portarias da SGD/MGI e a contextualizar a resposta no regime jurídico de TIC."
            aria-label="Sobre o Modo TIC"
          >
            <Info className="w-4 h-4"aria-hidden="true" />
          </span>
        </div>
      )}
    </div>
  );
}
