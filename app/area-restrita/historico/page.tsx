'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, Download, Eye, Loader2, ArrowLeft, FileText
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

export default function HistoricoPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [filter, setFilter] = useState<'all' | 'download' | 'view'>('all');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  const loadLogs = useCallback(async () => {
    try {
      setIsLoadingLogs(true);
      const url = filter === 'all'
        ? '/api/access-log'
        : `/api/access-log?action=${filter}`;

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

  useEffect(() => {
    if (user) {
      loadLogs();
    }
  }, [user, loadLogs]);

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

  // Encontrar documento nos cursos
  const findDocument = (courseId: string | null, documentId: string | null) => {
    if (!courseId || !documentId) return null;

    const course = courses.find(c => c.id === courseId);
    if (!course) return null;

    const doc = course.restrictedDocuments?.find(d => d.id === documentId) ||
                 course.publicDocuments?.find(d => d.id === documentId);

    return { course, doc };
  };

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
                  <h1 className="text-3xl font-bold text-gray-900">Histórico de Acesso</h1>
                  <p className="text-gray-600 mt-1">
                    Seus últimos {logs.length} acessos e downloads
                  </p>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex gap-3 mt-6">
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
              </div>
            </div>
          </div>

          {/* Lista de Logs */}
          {isLoadingLogs ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 border-2 border-gray-200 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Carregando histórico...</p>
            </div>
          ) : logs.length === 0 ? (
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
          )}
        </div>
      </div>
    </main>
  );
}
