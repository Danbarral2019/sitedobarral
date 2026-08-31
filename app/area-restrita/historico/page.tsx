'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
 Clock, Download, Eye, Loader2, ArrowLeft, FileText, Sparkles, Trash2, Search, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface AccessLog {
 id: string;
 action: string;
 courseId: string | null;
 documentId: string | null;
 documentTitle?: string;
 createdAt: string;
}

interface SearchHistoryEntry {
 id: string;
 query: string;
 aiAnswer: string | null;
 sources: string | null;
 legalSources: string | null;
 createdAt: string;
}

type FilterType = 'all' | 'download' | 'view' | 'ai-search';

// Unified timeline item
type TimelineItem =
 | { kind: 'log'; data: AccessLog; date: string }
 | { kind: 'search'; data: SearchHistoryEntry; date: string };

function formatRelativeDate(dateStr: string): string {
 const date = new Date(dateStr);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMin = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMs / 3600000);
 const diffDays = Math.floor(diffMs / 86400000);

 if (diffMin < 1) return 'Agora mesmo';
 if (diffMin < 60) return `${diffMin}min atrás`;
 if (diffHours < 24) return `${diffHours}h atrás`;
 if (diffDays === 1) return 'Ontem';
 if (diffDays < 7) return `${diffDays} dias atrás`;
 return date.toLocaleDateString('pt-BR');
}

export default function HistoricoPage() {
 const router = useRouter();
 const { user, isLoading } = useAuth();
 const [logs, setLogs] = useState<AccessLog[]>([]);
 const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
 const [isLoadingLogs, setIsLoadingLogs] = useState(true);
 const [isLoadingSearchHistory, setIsLoadingSearchHistory] = useState(true);
 const [filter, setFilter] = useState<FilterType>('all');
 const [expandedSearchId, setExpandedSearchId] = useState<string | null>(null);
 const [deletingId, setDeletingId] = useState<string | null>(null);

 // Document title cache (pre-fetched)
 const [docTitles, setDocTitles] = useState<Record<string, string>>({});

 useEffect(() => {
 if (!isLoading && !user) {
 router.push('/login');
 }
 }, [isLoading, user, router]);

 // Load access logs
 const loadLogs = useCallback(async () => {
 try {
 setIsLoadingLogs(true);
 const actionParam = filter === 'download' || filter === 'view' ? `?action=${filter}` : '';
 const response = await fetch(`/api/access-log${actionParam}`);
 if (response.ok) {
 const data = await response.json();
 const fetchedLogs: AccessLog[] = data.logs || [];
 setLogs(fetchedLogs);

 // Pre-fetch document titles for all logs
 const docIds = [...new Set(fetchedLogs.map(l => l.documentId).filter(Boolean))] as string[];
 const unknownIds = docIds.filter(id => !docTitles[id]);
 if (unknownIds.length > 0) {
 const titles: Record<string, string> = {};
 await Promise.all(
 unknownIds.slice(0, 50).map(async (docId) => {
 try {
 const res = await fetch(`/api/documents/${docId}`);
 if (res.ok) {
 const d = await res.json();
 titles[docId] = d.document?.title || 'Documento';
 }
 } catch { /* ignore */ }
 })
 );
 if (Object.keys(titles).length > 0) {
 setDocTitles(prev => ({ ...prev, ...titles }));
 }
 }
 }
 } catch (error) {
 console.error('Erro ao carregar histórico:', error);
 } finally {
 setIsLoadingLogs(false);
 }
 }, [filter, docTitles]);

 // Load search history
 const loadSearchHistory = useCallback(async () => {
 try {
 setIsLoadingSearchHistory(true);
 const response = await fetch('/api/area-restrita/search-history');
 if (response.ok) {
 const data = await response.json();
 setSearchHistory(data.history || []);
 }
 } catch (error) {
 console.error('Erro ao carregar pesquisas IA:', error);
 } finally {
 setIsLoadingSearchHistory(false);
 }
 }, []);

 const deleteSearchEntry = async (id: string) => {
 setDeletingId(id);
 try {
 const response = await fetch(`/api/area-restrita/search-history?id=${id}`, { method: 'DELETE' });
 if (response.ok) {
 setSearchHistory(prev => prev.filter(e => e.id !== id));
 if (expandedSearchId === id) setExpandedSearchId(null);
 }
 } catch (error) {
 console.error('Erro ao deletar pesquisa:', error);
 } finally {
 setDeletingId(null);
 }
 };

 // Load data based on filter
 useEffect(() => {
 if (!user) return;
 if (filter === 'ai-search') {
 loadSearchHistory();
 } else if (filter === 'all') {
 // Load both for unified timeline
 loadLogs();
 loadSearchHistory();
 } else {
 loadLogs();
 }
 }, [user, filter, loadLogs, loadSearchHistory]);

 if (isLoading) {
 return (
 <main className="min-h-screen flex items-center justify-center">
 <div className="text-center">
 <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto mb-4" />
 <p className="text-ink-secondary font-medium">Verificando acesso...</p>
 </div>
 </main>
 );
 }

 if (!user) return null;

 // Build unified timeline for "Todos"
 const buildTimeline = (): TimelineItem[] => {
 const items: TimelineItem[] = [];
 logs.forEach(log => items.push({ kind: 'log', data: log, date: log.createdAt }));
 if (filter === 'all') {
 searchHistory.forEach(s => items.push({ kind: 'search', data: s, date: s.createdAt }));
 }
 items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
 return items;
 };

 // Group items by date
 const groupByDate = <T extends { date: string }>(items: T[]): Record<string, T[]> => {
 const groups: Record<string, T[]> = {};
 items.forEach(item => {
 const dateKey = new Date(item.date).toLocaleDateString('pt-BR');
 if (!groups[dateKey]) groups[dateKey] = [];
 groups[dateKey].push(item);
 });
 return groups;
 };

 const getActionIcon = (action: string) => {
 switch (action) {
 case 'download': return <Download className="w-4 h-4" />;
 case 'view': return <Eye className="w-4 h-4" />;
 default: return <FileText className="w-4 h-4" />;
 }
 };

 const getActionLabel = (action: string) => {
 switch (action) {
 case 'download': return 'Download';
 case 'view': return 'Visualização';
 case 'access': return 'Acesso';
 default: return action;
 }
 };

 const getActionColor = (action: string) => {
 switch (action) {
 case 'download': return 'bg-surface-deep text-ink-primary border-border-subtle';
 case 'view': return 'bg-surface-deep text-ink-primary border-border-subtle';
 default: return 'bg-surface-deep text-ink-primary border-border-subtle';
 }
 };

 const isAiOnly = filter === 'ai-search';
 const isLoadingContent = filter === 'all'
 ? isLoadingLogs && isLoadingSearchHistory
 : isAiOnly ? isLoadingSearchHistory : isLoadingLogs;

 // Compute counts for subtitle
 const totalCount = filter === 'all'
 ? logs.length + searchHistory.length
 : isAiOnly ? searchHistory.length : logs.length;

 // Build content items
 const timelineItems = !isAiOnly ? buildTimeline() : [];
 const timelineByDate = !isAiOnly ? groupByDate(timelineItems) : {};
 const searchByDate = isAiOnly ? groupByDate(searchHistory.map(s => ({ ...s, date: s.createdAt }))) : {};

 // Render an access log item
 const renderLogItem = (log: AccessLog) => {
 const title = log.documentTitle || (log.documentId && docTitles[log.documentId]) || null;
 const time = new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

 return (
 <div
 key={log.id}
 className="flex items-start justify-between p-4 bg-surface-raised rounded-[3px] border border-border-subtle hover:border-border-strong transition-colors"
 >
 <div className="flex items-start gap-3 flex-1">
 <div className={`px-3 py-1 rounded-[3px] text-xs font-bold border flex items-center gap-1 ${getActionColor(log.action)}`}>
 {getActionIcon(log.action)}
 {getActionLabel(log.action)}
 </div>
 <div className="flex-1">
 {title ? (
 <h4 className="font-bold text-ink-primary text-sm">{title}</h4>
 ) : (
 <p className="text-ink-muted text-sm">Documento</p>
 )}
 </div>
 </div>
 <div className="text-sm text-ink-muted font-medium ml-4">{time}</div>
 </div>
 );
 };

 // Render a search history item
 const renderSearchItem = (entry: SearchHistoryEntry) => {
 const isExpanded = expandedSearchId === entry.id;
 const isDeleting = deletingId === entry.id;
 const previewAnswer = entry.aiAnswer
 ? entry.aiAnswer.replace(/\*\*/g, '').slice(0, 150) + (entry.aiAnswer.length > 150 ? '...' : '')
 : null;

 return (
 <div
 key={entry.id}
 className="p-4 bg-surface-raised rounded-[3px] border border-border-subtle hover:border-border-strong transition-colors"
 >
 <div className="flex items-start justify-between gap-3">
 <div
 className="flex-1 min-w-0 cursor-pointer"
 onClick={() => setExpandedSearchId(isExpanded ? null : entry.id)}
 >
 <div className="flex items-center gap-2 mb-1">
 <Sparkles className="w-4 h-4 text-ink-secondary flex-shrink-0" />
 <h4 className="font-bold text-ink-primary text-sm truncate">{entry.query}</h4>
 </div>
 {!isExpanded && previewAnswer && (
 <p className="text-xs text-ink-secondary line-clamp-2 ml-6">{previewAnswer}</p>
 )}
 {isExpanded && entry.aiAnswer && (
 <div className="mt-3 ml-6 text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
 {entry.aiAnswer.replace(/\*\*/g, '')}
 </div>
 )}
 </div>

 <div className="flex items-center gap-2 flex-shrink-0">
 <span className="text-xs text-ink-muted">{formatRelativeDate(entry.createdAt)}</span>
 <button
 onClick={() => setExpandedSearchId(isExpanded ? null : entry.id)}
 className="p-1 text-ink-muted hover:text-ink-secondary transition-colors"
 title={isExpanded ? 'Recolher' : 'Expandir'}
 >
 {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
 </button>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2 mt-3 ml-6">
 <button
 onClick={() => router.push(`/area-restrita?q=${encodeURIComponent(entry.query)}`)}
 className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-ink-secondary bg-surface-page border border-border-subtle rounded-[3px] hover:bg-surface-raised transition-colors"
 >
 <Search className="w-3 h-3" />
 Pesquisar novamente
 </button>
 <button
 onClick={() => deleteSearchEntry(entry.id)}
 disabled={isDeleting}
 className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-semantic-error bg-surface-page border border-border-subtle rounded-[3px] hover:bg-surface-raised transition-colors disabled:opacity-50"
 >
 {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
 Excluir
 </button>
 </div>
 </div>
 );
 };

 return (
 <main className="py-12 bg-surface-raised min-h-screen">
 <div className="container mx-auto px-4">
 <div className="max-w-4xl mx-auto">
 {/* Header */}
 <div className="mb-8">
 <button
 onClick={() => router.push('/area-restrita')}
 className="flex items-center gap-2 text-ink-secondary hover:text-brand-600 transition-colors mb-4 font-medium"
 >
 <ArrowLeft className="w-4 h-4" />
 Voltar para Área Restrita
 </button>

 <div className="bg-surface-page rounded-md p-8 border border-border-subtle">
 <div className="flex items-center gap-4 mb-4">
 <div className="w-14 h-14 bg-surface-raised rounded-full flex items-center justify-center">
 <Clock className="w-7 h-7 text-surface-page" />
 </div>
 <div>
 <h1 className="text-3xl font-bold text-ink-primary">Histórico</h1>
 <p className="text-ink-secondary mt-1">
 {totalCount} registro(s)
 {filter === 'all' && searchHistory.length > 0 && logs.length > 0 &&
 ` (${logs.length} acessos, ${searchHistory.length} pesquisas IA)`
 }
 </p>
 </div>
 </div>

 {/* Filtros */}
 <div className="flex gap-3 mt-6 flex-wrap">
 <button
 onClick={() => setFilter('all')}
 className={`px-4 py-2 rounded-[3px] font-semibold transition-colors ${
 filter === 'all' ? 'bg-brand-600 text-surface-page' : 'bg-surface-deep text-ink-secondary hover:bg-surface-deep'
 }`}
 >
 Todos
 </button>
 <button
 onClick={() => setFilter('download')}
 className={`px-4 py-2 rounded-[3px] font-semibold transition-colors flex items-center gap-2 ${
 filter === 'download' ? 'bg-brand-600 text-surface-page' : 'bg-surface-deep text-ink-secondary hover:bg-surface-deep'
 }`}
 >
 <Download className="w-4 h-4" />
 Downloads
 </button>
 <button
 onClick={() => setFilter('view')}
 className={`px-4 py-2 rounded-[3px] font-semibold transition-colors flex items-center gap-2 ${
 filter === 'view' ? 'bg-brand-600 text-surface-page' : 'bg-surface-deep text-ink-secondary hover:bg-surface-deep'
 }`}
 >
 <Eye className="w-4 h-4" />
 Visualizações
 </button>
 <button
 onClick={() => setFilter('ai-search')}
 className={`px-4 py-2 rounded-[3px] font-semibold transition-colors flex items-center gap-2 ${
 filter === 'ai-search' ? 'bg-brand-600 text-surface-page' : 'bg-surface-deep text-ink-secondary hover:bg-surface-deep'
 }`}
 >
 <Sparkles className="w-4 h-4" />
 Pesquisas IA
 </button>
 </div>
 </div>
 </div>

 {/* Content */}
 {isLoadingContent ? (
 <div className="bg-surface-page rounded-md p-12 border border-border-subtle text-center">
 <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto mb-4" />
 <p className="text-ink-secondary">Carregando histórico...</p>
 </div>
 ) : isAiOnly ? (
 /* === Pesquisas IA only === */
 searchHistory.length === 0 ? (
 <div className="bg-surface-page rounded-md p-12 border border-border-subtle text-center">
 <Sparkles className="w-16 h-16 text-ink-muted mx-auto mb-4" />
 <h3 className="text-xl font-bold text-ink-primary mb-2">Nenhuma pesquisa IA encontrada</h3>
 <p className="text-ink-secondary">Suas pesquisas com IA aparecerão aqui</p>
 </div>
 ) : (
 <div className="space-y-6">
 {Object.entries(searchByDate).map(([date, entries]) => (
 <div key={date} className="bg-surface-page rounded-md p-6 border border-border-subtle">
 <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2">
 <Clock className="w-5 h-5" />
 {date}
 </h3>
 <div className="space-y-3">
 {entries.map(entry => renderSearchItem(entry))}
 </div>
 </div>
 ))}
 </div>
 )
 ) : (
 /* === Unified Timeline (Todos / Downloads / Views) === */
 timelineItems.length === 0 ? (
 <div className="bg-surface-page rounded-md p-12 border border-border-subtle text-center">
 <Clock className="w-16 h-16 text-ink-muted mx-auto mb-4" />
 <h3 className="text-xl font-bold text-ink-primary mb-2">Nenhum registro encontrado</h3>
 <p className="text-ink-secondary">Seus acessos, downloads e pesquisas aparecerão aqui</p>
 </div>
 ) : (
 <div className="space-y-6">
 {Object.entries(timelineByDate).map(([date, items]) => (
 <div key={date} className="bg-surface-page rounded-md p-6 border border-border-subtle">
 <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2">
 <Clock className="w-5 h-5" />
 {date}
 </h3>
 <div className="space-y-3">
 {items.map(item =>
 item.kind === 'search'
 ? renderSearchItem(item.data)
 : renderLogItem(item.data)
 )}
 </div>
 </div>
 ))}
 </div>
 )
 )}
 </div>
 </div>
 </main>
 );
}
