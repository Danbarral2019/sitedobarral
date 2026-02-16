'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import {
  Search, TrendingUp, AlertTriangle, FileText, Users,
  Loader2, AlertCircle, Calendar, BarChart3
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
}

export default function SearchAnalyticsPage() {
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
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="p-8">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-900 mb-1">Erro</h3>
              <p className="text-red-700">{error || 'Erro desconhecido'}</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const maxDailyCount = data.dailyVolume.length > 0
    ? Math.max(...data.dailyVolume.map(d => d.count))
    : 1;

  const avgDaily = data.dailyVolume.length > 0
    ? (data.dailyVolume.reduce((sum, d) => sum + d.count, 0) / data.dailyVolume.length).toFixed(1)
    : '0';

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics de Busca</h1>
              <p className="text-gray-600">Dados de uso do assistente IA e busca global</p>
            </div>
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
      </div>
    </AdminLayout>
  );
}
