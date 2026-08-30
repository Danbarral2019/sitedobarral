'use client';

import { Search, Filter, ChevronUp, ChevronDown } from 'lucide-react';

interface LegislacaoToolbarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  sortFilter: string;
  onSortChange: (v: string) => void;
  showHierarchyOption: boolean;
  hasActiveFilters: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
}

export function LegislacaoToolbar({
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  sortFilter,
  onSortChange,
  showHierarchyOption,
  hasActiveFilters,
  showFilters,
  onToggleFilters,
}: LegislacaoToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-4">
      <div className="flex-1 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-12 pr-4 py-4 border-2 border-border-strong rounded-md focus:ring-2 focus:ring-amber-accent focus:border-transparent text-lg"
        />
      </div>

      <select
        value={sortFilter}
        onChange={(e) => onSortChange(e.target.value)}
        className="px-4 py-4 bg-surface-page border-2 border-border-strong rounded-md hover:border-brand-600 font-semibold text-sm focus:ring-2 focus:ring-amber-accent cursor-pointer"
        aria-label="Ordenar por"
        title="Ordenar por"
      >
        <option value="recent">Mais recentes</option>
        <option value="oldest">Mais antigos</option>
        {showHierarchyOption && (
          <>
            <option value="hierarchy">Hierarquia (lei → OS)</option>
            <option value="number">Por número</option>
          </>
        )}
        <option value="alpha">Alfabética A→Z</option>
      </select>

      <button
        onClick={onToggleFilters}
        className="flex items-center justify-center gap-2 px-6 py-4 bg-surface-page border-2 border-border-strong rounded-md hover:border-brand-600 hover:bg-surface-raised transition-all"
      >
        <Filter className="w-5 h-5" />
        <span className="font-semibold">Filtros</span>
        {hasActiveFilters && <span className="ml-2 w-2 h-2 bg-brand-600 rounded-full" />}
        {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
    </div>
  );
}
