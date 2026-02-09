'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, Download, Eye, Loader2, ArrowLeft, FileText, Sparkles, Trash2, Search, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { courses } from '@/data/courses';

interface AccessLog {
  id: string;
  action: string;
  courseId: string | null;
  documentId: string | null;
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
  const [isLoadingSearchHistory, setIsLoadingSearchHistory] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedSearchId, setExpandedSearchId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Cache de documentos buscados
  const [documentsCache, setDocumentsCache] = useState<Record<string, unknown>>({});

  // Encontrar documento (busca no banco se necessário)
  const findDocument = useCallback(async (courseId: string | null, documentId: string | null) => {
    if (!courseId || !documentId) return null;

    const course = courses.find(c => c.id === courseId);
    if (!course) return null;

    // Verificar cache primeiro
    const cacheKey = `${courseId}-${documentId}`;
    if (documentsCache[cacheKey]) {
      return { course, doc: documentsCache[cacheKey] };
    }

    // Buscar do banco
    try {
      const response = await fetch(`/api/documents/${documentId}`);
      if (response.ok) {
        const data = await response.json();
        const doc = data.document;

        // Adicionar ao cache
        setDocumentsCache(prev => ({ ...prev, [cacheKey]: doc }));

        return { course, doc };
      }
    } catch (error) {
      console.error('Erro ao buscar documento:', error);
    }

    return null;
  }, [documentsCache]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  const loadLogs = useCallback(async () => {
    try {
      setIsLoadingLogs(true);
      const actionFilter = filter === 'all' || filter === 'ai-search' ? 'all' : filter;
      const url = actionFilter === 'all'
        ? '/api/access-log'
        : `/api/access-log?action=${actionFilter}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [filter]);

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

  useEffect(() => {
    if (user) {
      if (filter === 'ai-search') {
        loadSearchHistory();
      } else {
        loadLogs();
      }
    }
  }, [user, filter, loadLogs, loadSearchHistory]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Verificando acesso...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  // Agrupa logs por data
  const logsByDate: Record<string, AccessLog[]> = {};
  logs.forEach(log => {
    const date = new Date(log.createdAt).toLocaleDateString('pt-BR');
    if (!logsByDate[date]) {
      logsByDate[date] = [];
    }
    logsByDate[date].push(log);
  });

  // Agrupa pesquisas IA por data
  const searchByDate: Record<string, SearchHistoryEntry[]> = {};
  searchHistory.forEach(entry => {
    const date = new Date(entry.createdAt).toLocaleDateString('pt-BR');
    if (!searchByDate[date]) {
      searchByDate[date] = [];
    }
    searchByDate[date].push(entry);
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'download':
        return <Download className="w-4 h-4" />;
      case 'view':
        return <Eye className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'download':
        return 'Download';
      case 'view':
        return 'Visualização';
      case 'access':
        return 'Acesso';
      default:
        return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'download':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'view':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isAiTab = filter === 'ai-search';
  const isLoadingContent = isAiTab ? isLoadingSearchHistory : isLoadingLogs;

  return (
    <main className="py-12 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push('/area-restrita')}
              className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors mb-4 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Área Restrita
            </button>

            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <Clock className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Histórico</h1>
                  <p className="text-gray-600 mt-1">
                    {isAiTab
                      ? `${searchHistory.length} pesquisa(s) com IA`
                      : `Seus últimos ${logs.length} acessos e downloads`
                    }
                  </p>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex gap-3 mt-6 flex-wrap">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilter('download')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                    filter === 'download'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Downloads
                </button>
                <button
                  onClick={() => setFilter('view')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                    filter === 'view'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Visualizações
                </button>
                <button
                  onClick={() => setFilter('ai-search')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                    filter === 'ai-search'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            <div className="bg-white rounded-2xl shadow-lg p-12 border-2 border-gray-200 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Carregando histórico...</p>
            </div>
          ) : isAiTab ? (
            /* === Pesquisas IA === */
            searchHistory.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 border-2 border-gray-200 text-center">
                <Sparkles className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma pesquisa IA encontrada</h3>
                <p className="text-gray-600">
                  Suas pesquisas com IA aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(searchByDate).map(([date, entries]) => (
                  <div key={date} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      {date}
                    </h3>

                    <div className="space-y-3">
                      {entries.map((entry) => {
                        const isExpanded = expandedSearchId === entry.id;
                        const isDeleting = deletingId === entry.id;
                        const previewAnswer = entry.aiAnswer
                          ? entry.aiAnswer.replace(/\*\*/g, '').slice(0, 150) + (entry.aiAnswer.length > 150 ? '...' : '')
                          : null;

                        return (
                          <div
                            key={entry.id}
                            className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 hover:border-purple-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => setExpandedSearchId(isExpanded ? null : entry.id)}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                  <h4 className="font-bold text-gray-900 text-sm truncate">
                                    {entry.query}
                                  </h4>
                                </div>
                                {!isExpanded && previewAnswer && (
                                  <p className="text-xs text-gray-600 line-clamp-2 ml-6">
                                    {previewAnswer}
                                  </p>
                                )}
                                {isExpanded && entry.aiAnswer && (
                                  <div className="mt-3 ml-6 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {entry.aiAnswer.replace(/\*\*/g, '')}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-gray-500">
                                  {formatRelativeDate(entry.createdAt)}
                                </span>
                                <button
                                  onClick={() => setExpandedSearchId(isExpanded ? null : entry.id)}
                                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
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
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-purple-700 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                              >
                                <Search className="w-3 h-3" />
                                Pesquisar novamente
                              </button>
                              <button
                                onClick={() => deleteSearchEntry(entry.id)}
                                disabled={isDeleting}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                                Excluir
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* === Access Logs === */
            logs.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 border-2 border-gray-200 text-center">
                <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum registro encontrado</h3>
                <p className="text-gray-600">
                  Seus acessos e downloads aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(logsByDate).map(([date, dateLogs]) => (
                  <div key={date} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      {date}
                    </h3>

                    <div className="space-y-3">
                      {dateLogs.map((log) => {
                        const result = findDocument(log.courseId, log.documentId);
                        const time = new Date(log.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div
                            key={log.id}
                            className="flex items-start justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 ${getActionColor(log.action)}`}>
                                {getActionIcon(log.action)}
                                {getActionLabel(log.action)}
                              </div>

                              <div className="flex-1">
                                {result ? (
                                  <>
                                    <h4 className="font-bold text-gray-900">{result.doc?.title}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{result.course.title}</p>
                                    {result.doc?.category && (
                                      <span className="inline-block mt-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                        {result.doc.category}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-gray-600">Documento não disponível</p>
                                )}
                              </div>
                            </div>

                            <div className="text-sm text-gray-500 font-medium ml-4">
                              {time}
                            </div>
                          </div>
                        );
                      })}
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
