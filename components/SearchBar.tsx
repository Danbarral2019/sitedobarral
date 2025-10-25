'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, SlidersHorizontal, Loader2 } from 'lucide-react';
import { SearchScope } from '@/hooks/use-search';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  scope: SearchScope;
  onScopeToggle: () => void;
  onFiltersClick: () => void;
  activeFiltersCount: number;
  resultsCount?: number;
  isSearching?: boolean;
  currentCourseName?: string;
}

export default function SearchBar({
  value,
  onChange,
  onClear,
  scope,
  onScopeToggle,
  onFiltersClick,
  activeFiltersCount,
  resultsCount,
  isSearching = false,
  currentCourseName,
}: SearchBarProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce do input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(debouncedValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [debouncedValue, onChange]);

  const handleClear = () => {
    setDebouncedValue('');
    onClear();
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-lg sticky top-0 z-30 p-3 lg:p-4 mb-4">
      {/* Barra de Busca Principal */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Ícone de Busca */}
        <div className="flex-shrink-0">
          {isSearching ? (
            <Loader2 className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600 animate-spin" />
          ) : (
            <Search className="w-5 h-5 lg:w-6 lg:h-6 text-gray-400" />
          )}
        </div>

        {/* Input de Busca */}
        <input
          ref={inputRef}
          type="text"
          value={debouncedValue}
          onChange={(e) => setDebouncedValue(e.target.value)}
          placeholder="Buscar documentos, acórdãos, pareceres..."
          className="flex-1 text-sm lg:text-base text-gray-900 placeholder-gray-400 focus:outline-none min-w-0"
        />

        {/* Botão Limpar */}
        {debouncedValue && (
          <button
            onClick={handleClear}
            className="flex-shrink-0 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Limpar busca"
          >
            <X className="w-4 h-4 lg:w-5 lg:h-5 text-gray-500" />
          </button>
        )}

        {/* Botão de Filtros */}
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

      {/* Toggle de Escopo + Contador de Resultados */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
        {/* Toggle de Escopo */}
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

        {/* Contador de Resultados */}
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
