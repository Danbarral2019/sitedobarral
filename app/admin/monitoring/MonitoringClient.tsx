'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Users, LogIn, Download, UserPlus, RefreshCw, Server, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface MonitoringData {
  cards: {
    activeUsers24h: number;
    loginsToday: number;
    loginsWeek: number;
    downloadsToday: number;
    downloadsWeek: number;
    registrosWeek: number;
  };
  recentActivity: Array<{
    id: string;
    userId: string | null;
    action: string;
    documentId: string | null;
    courseId: string | null;
    ip: string | null;
    createdAt: string;
    userName: string;
  }>;
  dailyActivity: Array<{
    date: string;
    logins: number;
    downloads: number;
    views: number;
    access: number;
  }>;
  scraperHealth: Array<{
    scraperCode: string;
    status: string;
    itemsFound: number;
    itemsNew: number;
    itemsError: number;
    duration: number;
    errorMessage: string | null;
    runAt: string;
  }>;
}

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  access: 'Acesso',
  download: 'Download',
  view: 'Visualizacao',
};

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-100 text-blue-800',
  access: 'bg-green-100 text-green-800',
  download: 'bg-purple-100 text-purple-800',
  view: 'bg-yellow-100 text-yellow-800',
};

export default function MonitoringClient() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/monitoring');
      if (!res.ok) throw new Error('Erro ao carregar dados');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Activity className="w-8 h-8 animate-pulse text-blue-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-600">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>{error}</p>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) return null;

  const filteredActivity = actionFilter === 'all'
    ? data.recentActivity
    : data.recentActivity.filter(a => a.action === actionFilter);

  const maxBarValue = Math.max(
    ...data.dailyActivity.map(d => d.logins + d.downloads + d.views + d.access),
    1
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoramento</h1>
          <p className="text-gray-500 text-sm mt-1">Visao geral do sistema em tempo real</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Cards de saude */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Ativos 24h" value={data.cards.activeUsers24h} color="blue" />
        <StatCard icon={LogIn} label="Logins hoje" value={data.cards.loginsToday} subtitle={`${data.cards.loginsWeek} esta semana`} color="green" />
        <StatCard icon={Download} label="Downloads hoje" value={data.cards.downloadsToday} subtitle={`${data.cards.downloadsWeek} esta semana`} color="purple" />
        <StatCard icon={UserPlus} label="Registros semana" value={data.cards.registrosWeek} color="orange" />
      </div>

      {/* Grafico de atividade (ultimos 14 dias) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Atividade (14 dias)</h2>
        <div className="flex items-center gap-4 mb-4 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Logins</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500" /> Downloads</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" /> Views</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Acessos</span>
        </div>
        <div className="flex items-end gap-1 h-40">
          {data.dailyActivity.map((day) => {
            const total = day.logins + day.downloads + day.views + day.access;
            const heightPct = (total / maxBarValue) * 100;
            const loginPct = total > 0 ? (day.logins / total) * 100 : 0;
            const downloadPct = total > 0 ? (day.downloads / total) * 100 : 0;
            const viewPct = total > 0 ? (day.views / total) * 100 : 0;

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: `${heightPct}%`, minHeight: total > 0 ? '4px' : '0' }}>
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${loginPct}%`, minHeight: loginPct > 0 ? '2px' : '0' }} />
                  <div className="w-full bg-purple-500" style={{ height: `${downloadPct}%`, minHeight: downloadPct > 0 ? '2px' : '0' }} />
                  <div className="w-full bg-yellow-500" style={{ height: `${viewPct}%`, minHeight: viewPct > 0 ? '2px' : '0' }} />
                  <div className="w-full bg-green-500 rounded-b" style={{ height: `${100 - loginPct - downloadPct - viewPct}%`, minHeight: total - day.logins - day.downloads - day.views > 0 ? '2px' : '0' }} />
                </div>
                <span className="text-[10px] text-gray-400">{day.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Atividade recente */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Atividade recente</h2>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">Todas</option>
            <option value="login">Logins</option>
            <option value="download">Downloads</option>
            <option value="view">Views</option>
            <option value="access">Acessos</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Acao</th>
                <th className="pb-2 font-medium">Usuario</th>
                <th className="pb-2 font-medium hidden md:table-cell">Documento</th>
                <th className="pb-2 font-medium hidden lg:table-cell">IP</th>
                <th className="pb-2 font-medium">Quando</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivity.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[item.action] || 'bg-gray-100 text-gray-800'}`}>
                      {ACTION_LABELS[item.action] || item.action}
                    </span>
                  </td>
                  <td className="py-2 text-gray-700">{item.userName}</td>
                  <td className="py-2 text-gray-500 hidden md:table-cell font-mono text-xs">
                    {item.documentId ? item.documentId.slice(0, 8) + '...' : '\u2014'}
                  </td>
                  <td className="py-2 text-gray-400 hidden lg:table-cell font-mono text-xs">{item.ip || '\u2014'}</td>
                  <td className="py-2 text-gray-500 text-xs">{formatRelativeTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status dos Scrapers */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Server className="w-5 h-5" /> Status dos Scrapers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.scraperHealth.map((scraper) => (
            <div key={scraper.scraperCode} className={`p-4 rounded-lg border ${
              scraper.status === 'success' ? 'border-green-200 bg-green-50' :
              scraper.status === 'partial_failure' ? 'border-yellow-200 bg-yellow-50' :
              'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{scraper.scraperCode}</span>
                {scraper.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : scraper.status === 'partial_failure' ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p>Encontrados: {scraper.itemsFound} | Novos: {scraper.itemsNew} | Erros: {scraper.itemsError}</p>
                <p>Duracao: {(scraper.duration / 1000).toFixed(1)}s</p>
                <p>Ultimo run: {formatRelativeTime(scraper.runAt)}</p>
                {scraper.errorMessage && (
                  <p className="text-red-600 truncate" title={scraper.errorMessage}>
                    {scraper.errorMessage.slice(0, 100)}
                  </p>
                )}
              </div>
            </div>
          ))}
          {data.scraperHealth.length === 0 && (
            <p className="text-gray-500 col-span-full text-center py-4">Nenhum registro de scraper encontrado</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtitle, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtitle?: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`w-10 h-10 rounded-lg ${colorMap[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString('pt-BR')}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
