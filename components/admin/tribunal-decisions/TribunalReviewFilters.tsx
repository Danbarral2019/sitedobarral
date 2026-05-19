'use client';

import { Filter, Search } from 'lucide-react';
import type { DecisionTab, DecisionSort, TribunalStats } from '@/hooks/use-tribunal-decisions';

interface TribunalReviewFiltersProps {
  stats: TribunalStats | null;
  availableTribunals: string[];
  activeTab: DecisionTab;
  onTabChange: (tab: DecisionTab) => void;
  filterTribunal: string;
  onTribunalChange: (v: string) => void;
  searchText: string;
  onSearchChange: (v: string) => void;
  sortBy: DecisionSort;
  onSortChange: (v: DecisionSort) => void;
}

const TABS: { key: DecisionTab; label: string; countKey?: 'totalPending' | 'total' }[] = [
  { key: 'pending', label: 'Pendentes', countKey: 'totalPending' },
  { key: 'auto_approved', label: 'Auto-aprovados' },
  { key: 'manually_approved', label: 'Aprovados' },
  { key: 'auto_rejected', label: 'Auto-rejeitados' },
  { key: 'manually_rejected', label: 'Rejeitados' },
  { key: 'all', label: 'Todos', countKey: 'total' },
];

export function TribunalReviewFilters({
  stats,
  availableTribunals,
  activeTab,
  onTabChange,
  filterTribunal,
  onTribunalChange,
  searchText,
  onSearchChange,
  sortBy,
  onSortChange,
}: TribunalReviewFiltersProps) {
  return (
    <div className="p-6 border-b">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Filter className="w-5 h-5" />
        Fila de Revisao
      </h2>

      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => {
          const count = tab.countKey && stats ? stats[tab.countKey] : undefined;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} {count !== undefined && `(${count})`}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filterTribunal}
          onChange={(e) => onTribunalChange(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          <option value="">Todos os tribunais</option>
          {availableTribunals.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as DecisionSort)}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          <option value="relevanceScore">Maior score primeiro</option>
          <option value="createdAt">Mais recentes primeiro</option>
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar decisoes..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </div>
    </div>
  );
}
