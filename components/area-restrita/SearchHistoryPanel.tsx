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
 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink-secondary hover:bg-surface-deep rounded-[3px] transition-colors"
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
 <div className="mt-2 bg-surface-page rounded-md border border-border-subtle overflow-hidden">
 {/* Header with collapse button */}
 <button
 onClick={onToggle}
 className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-border-subtle bg-surface-raised hover:bg-surface-deep transition-colors"
 >
 <Clock className="w-4 h-4 text-ink-muted" />
 <span className="text-sm font-medium text-ink-secondary flex-1 text-left">Pesquisas recentes</span>
 <ChevronDown className="w-4 h-4 text-ink-muted rotate-180" />
 </button>

 {/* List */}
 {isLoading ? (
 <div className="p-4 space-y-3">
 {[1, 2, 3].map(i => (
 <div key={i} className="animate-pulse flex gap-3">
 <div className="w-4 h-4 bg-surface-deep rounded flex-shrink-0 mt-0.5" />
 <div className="flex-1">
 <div className="h-3 bg-surface-deep rounded w-3/4 mb-1.5" />
 <div className="h-2.5 bg-surface-deep rounded w-1/2" />
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
 className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-brand-50 transition-colors text-left group border-b border-border-subtle last:border-b-0 cursor-pointer"
 >
 {entry.aiAnswer ? (
 <Sparkles className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
 ) : (
 <Search className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" />
 )}
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-ink-primary truncate group-hover:text-brand-700 transition-colors">
 {entry.query}
 </p>
 {entry.aiAnswer && (
 <p className="text-xs text-ink-muted mt-0.5 line-clamp-1">
 {entry.aiAnswer.slice(0, 100)}...
 </p>
 )}
 </div>
 <div className="flex items-center gap-1.5 flex-shrink-0">
 <span className="text-xs text-ink-muted">{formatDate(entry.createdAt)}</span>
 <button
 onClick={(e) => handleDelete(entry.id, e)}
 className="p-1 rounded text-border-strong hover:text-semantic-error hover:bg-surface-raised opacity-0 group-hover:opacity-100 transition-all"
 title="Remover"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 <ChevronRight className="w-3.5 h-3.5 text-border-strong group-hover:text-brand-400 transition-colors" />
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
