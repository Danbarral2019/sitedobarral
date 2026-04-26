'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, TrendingUp, AlertTriangle, FileText, Users,
  Loader2, AlertCircle, Calendar, BarChart3, ThumbsDown, ThumbsUp, Download
} from 'lucide-react';

interface SearchAnalyticsData {
  totalSearches: number;
  recentSearches: number;
  topQueries: Array<{
    query: string;
    count: number;
    lastUsed: string;
  }>;
  dailyVolume: Array<{
    date: string;
    count: number;
  }>;
  failedQueries: Array<{
    id: string;
    query: string;
    createdAt: string;
  }>;
  shortQueries: Array<{
    query: string;
    count: number;
  }>;
  topSources: Array<{
    title: string;
    count: number;
    type: string;
  }>;
  topUsers: Array<{
    userId: string;
    name: string;
    email: string;
    count: number;
  }>;
  feedback?: {
    positiveCount: number;
    negativeCount: number;
    noFeedbackCount: number;
    negativeFeedbackTop: Array<{
      query: string;
      count: number;
      lastUsed: string;
      type: string;
    }>;
    negativeFeedbackRecent: Array<{
      id: string;
      type: string;
      query: string;
      filters: string | null;
      note: string | null;
      feedbackAt: string | null;
      createdAt: string;
    }>;
  };
}

export default function SearchAnalyticsClient() {
  const router = useRouter();
  const [data, setData] = useState<SearchAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const authResponse = await fetch('/api/auth/verify');
        if (!authResponse.ok) {
          router.push('/validar-acesso');
          return;
        }
        const authData = await authResponse.json();
        if (authData.user.role !== 'admin') {
          router.push('/area-restrita');
          return;
        }

        const response = await fetch('/api/admin/search-analytics');
        if (!response.ok) throw new Error('Erro ao carregar dados');

        const result = await response.json();
        setData(result.data);
      } catch (err) {
        console.error('Erro:', err);
        setError('Erro ao carregar analytics de busca');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-red-900 mb-1">Erro</h3>
            <p className="text-red-700">{error || 'Erro desconhecido'}</p>
          </div>
        </div>
      </div>
    );
  }

  const maxDailyCount = data.dailyVolume.length > 0
    ? Math.max(...data.dailyVolume.map(d => d.count))
    : 1;

  const avgDaily = data.dailyVolume.length > 0
    ? (data.dailyVolume.reduce((sum, d) => sum + d.count, 0) / data.dailyVolume.length).toFixed(1)
    : '0';

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics de Busca</h1>
              <p className="text-gray-600">Dados de uso do assistente IA e busca global</p>
            </div>
          </div>
          <a
            href="/api/admin/search-analytics/export?days=30"
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium"
            title="Exporta SearchHistory dos últimos 30 dias como CSV"
          >
            <Download className="w-4 h-4" />
            Exportar CSV (30 dias)
          </a>
        </div>
      </div>

      {/* Cards de estatisticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Search className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{data.totalSearches}</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">Total de Buscas</h3>
          <p className="text-sm opacity-90">Desde o inicio</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{data.recentSearches}</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">Ultimos 30 dias</h3>
          <p className="text-sm opacity-90">Media: {avgDaily}/dia</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <AlertTriangle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{data.failedQueries.length}</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">Sem Resposta IA</h3>
          <p className="text-sm opacity-90">Ultimos 30 dias</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{data.topSources.length}</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">Fontes Citadas</h3>
          <p className="text-sm opacity-90">Distintas nos ultimos 30 dias</p>
        </div>
      </div>

      {/* Grafico de volume diario */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-6 h-6 text-violet-600" />
          <h2 className="text-xl font-bold text-gray-900">Volume Diario de Buscas (30 dias)</h2>
        </div>

        <div className="overflow-x-auto">
          {data.dailyVolume.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">Nenhuma busca registrada nos ultimos 30 dias</p>
          ) : (
            <div className="flex items-end gap-1 min-w-max" style={{ height: '220px' }}>
              {data.dailyVolume.map((day) => {
                const height = maxDailyCount > 0 ? (day.count / maxDailyCount) * 100 : 0;
                const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                });

                return (
                  <div key={day.date} className="flex flex-col items-center gap-1 flex-1 min-w-[28px]">
                    <div className="text-xs font-semibold text-gray-700">{day.count}</div>
                    <div
                      className="w-full bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-md transition-all hover:from-violet-700 hover:to-violet-500 min-h-[2px]"
                      style={{ height: `${Math.max(height, 1)}%` }}
                      title={`${dateLabel}: ${day.count} buscas`}
                    />
                    <div className="text-[10px] text-gray-500 -rotate-45 origin-top-left whitespace-nowrap mt-1">
                      {dateLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top queries */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Queries Populares</h2>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {data.topQueries.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma busca registrada</p>
            ) : (
              data.topQueries.map((q, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">{q.query}</p>
                    <p className="text-xs text-gray-500">
                      Ultima: {new Date(q.lastUsed).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-blue-600 flex-shrink-0">
                    {q.count}x
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top fontes citadas */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-gray-900">Fontes Mais Citadas</h2>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {data.topSources.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma fonte registrada</p>
            ) : (
              data.topSources.map((src, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-7 h-7 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">{src.title}</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                      src.type === 'legislacao'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {src.type}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-emerald-600 flex-shrink-0">
                    {src.count}x
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Queries problematicas */}
        <div className="bg-white rounded-xl shadow-md border-2 border-amber-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <h2 className="text-xl font-bold text-gray-900">Queries Problematicas</h2>
          </div>

          {data.failedQueries.length === 0 && data.shortQueries.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma query problematica nos ultimos 30 dias</p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {data.shortQueries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-800 mb-2">
                    Queries muito curtas (&lt; 3 caracteres)
                  </h3>
                  <div className="space-y-1">
                    {data.shortQueries.map((q, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg text-sm">
                        <code className="text-amber-900 font-mono">&quot;{q.query}&quot;</code>
                        <span className="text-amber-700 font-bold">{q.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.failedQueries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-800 mb-2">
                    Sem resposta da IA ({data.failedQueries.length})
                  </h3>
                  <div className="space-y-1">
                    {data.failedQueries.slice(0, 20).map((q) => (
                      <div key={q.id} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg text-sm">
                        <span className="text-gray-900 truncate flex-1 mr-2">{q.query}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    ))}
                    {data.failedQueries.length > 20 && (
                      <p className="text-xs text-gray-500 mt-2">
                        ... e mais {data.failedQueries.length - 20} queries
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top usuarios */}
        <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Usuarios Mais Ativos</h2>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {data.topUsers.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum usuario registrado</p>
            ) : (
              data.topUsers.map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-7 h-7 bg-purple-600 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="text-sm font-bold text-purple-600 flex-shrink-0">
                    {user.count} buscas
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Feedback loop — queries marcadas 👎 pelos alunos */}
      {data.feedback && (
        <div className="mt-8 bg-white rounded-xl shadow-md border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ThumbsDown className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">Feedback dos alunos</h2>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="w-4 h-4 text-green-600" />
                <span className="font-bold text-green-700">{data.feedback.positiveCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ThumbsDown className="w-4 h-4 text-red-600" />
                <span className="font-bold text-red-700">{data.feedback.negativeCount}</span>
              </div>
              <span className="text-xs text-gray-500">
                ({data.feedback.noFeedbackCount} sem feedback)
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-5">
            Queries marcadas como 👎 pelos alunos nos últimos 30 dias. Use como
            prioridade para (a) melhorar retrieval (casos em que o resultado
            não ajudou), (b) expandir o golden set com as queries recorrentes.
          </p>

          {data.feedback.negativeCount === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ThumbsDown className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhuma resposta foi marcada como ruim nos últimos 30 dias.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top queries 👎 agrupadas */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Top queries recorrentes
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {data.feedback.negativeFeedbackTop.length === 0 ? (
                    <p className="text-xs text-gray-500">—</p>
                  ) : (
                    data.feedback.negativeFeedbackTop.map((q, i) => (
                      <div
                        key={`${q.query}-${i}`}
                        className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg"
                      >
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-red-600 text-white rounded text-xs font-bold flex-shrink-0">
                          {q.count}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 break-words">{q.query}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded">
                              {q.type}
                            </span>
                            <span>
                              último: {new Date(q.lastUsed).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Lista recente com detalhes pra drill-in */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Últimas ocorrências (com filtros e nota)
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {data.feedback.negativeFeedbackRecent.length === 0 ? (
                    <p className="text-xs text-gray-500">—</p>
                  ) : (
                    data.feedback.negativeFeedbackRecent.map(r => (
                      <div
                        key={r.id}
                        className="p-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm text-gray-900 break-words flex-1">{r.query}</p>
                          <span className="inline-block px-1.5 py-0.5 bg-gray-200 rounded text-xs flex-shrink-0">
                            {r.type}
                          </span>
                        </div>
                        {r.filters && (
                          <p className="text-xs text-gray-500 font-mono break-all mt-1">
                            filtros: {r.filters}
                          </p>
                        )}
                        {r.note && (
                          <p className="text-xs text-gray-700 mt-1 italic">
                            “{r.note}”
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {r.feedbackAt
                            ? new Date(r.feedbackAt).toLocaleString('pt-BR')
                            : new Date(r.createdAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
