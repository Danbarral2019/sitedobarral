'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Trash2, Search, Sparkles, ChevronRight, ChevronDown } from 'lucide-react';

interface SearchHistoryEntry {
  id: string;
  query: string;
  aiAnswer: string | null;
  createdAt: string;
}

interface SearchHistoryPanelProps {
  onSelectQuery: (query: string) => void;
  isVisible: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function SearchHistoryPanel({ onSelectQuery, isVisible, collapsed = false, onToggle }: SearchHistoryPanelProps) {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/area-restrita/search-history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch {
      // Silently ignore
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, []);

  useEffect(() => {
    if (isVisible && !hasFetched) {
      fetchHistory();
    }
  }, [isVisible, hasFetched, fetchHistory]);

  // Refetch when expanding
  useEffect(() => {
    if (isVisible && !collapsed) {
      fetchHistory();
    }
  }, [isVisible, collapsed, fetchHistory]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/area-restrita/search-history?id=${id}`, { method: 'DELETE' });
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch {
      // Silently ignore
    }
  };

  if (!isVisible || (hasFetched && history.length === 0)) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  // Collapsed mode: just a small toggle button
  if (collapsed) {
    return (
      <div className="mt-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pesquisas recentes</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Expanded mode
  return (
    <div className="mt-2 bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Header with collapse button */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <Clock className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 flex-1 text-left">Pesquisas recentes</span>
        <ChevronDown className="w-4 h-4 text-gray-400 rotate-180" />
      </button>

      {/* List */}
      {isLoading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-4 h-4 bg-gray-200 rounded flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {history.map((entry) => (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectQuery(entry.query)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelectQuery(entry.query); }}
              className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-brand-50 transition-colors text-left group border-b border-gray-50 last:border-b-0 cursor-pointer"
            >
              {entry.aiAnswer ? (
                <Sparkles className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-brand-700 transition-colors">
                  {entry.query}
                </p>
                {entry.aiAnswer && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {entry.aiAnswer.slice(0, 100)}...
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-gray-400">{formatDate(entry.createdAt)}</span>
                <button
                  onClick={(e) => handleDelete(entry.id, e)}
                  className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-400 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
