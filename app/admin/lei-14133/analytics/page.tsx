'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  ThumbsUp,
  Clock,
  Zap,
  Download,
  Calendar,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface AnalyticsData {
  success: boolean;
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  overview: {
    totalQuestions: number;
    questionsWithFeedback: number;
    feedbackRate: string;
    satisfactionRate: string;
    positiveFeedback: number;
    negativeFeedback: number;
    avgTokens: number;
    totalTokens: number;
    avgLatency: number;
    cacheHitRate: string;
  };
  topArticles: Array<{
    articleNumber: string;
    questionsCount: number;
  }>;
  recentQuestions: Array<{
    id: string;
    articleNumber: string;
    question: string;
    wasHelpful: boolean | null;
    createdAt: string;
    latency: number | null;
    cached: boolean | null;
    user: {
      name: string;
      email: string;
    };
  }>;
  questionsByDay: Array<{
    date: string;
    count: number;
  }>;
  hourDistribution: Array<{
    hour: number;
    count: number;
  }>;
  topUsers: Array<{
    userId: string;
    name: string;
    email: string;
    questionsCount: number;
  }>;
}

export default function Lei14133AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/lei-14133/analytics?days=${selectedPeriod}`
      );

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/admin/login');
          return;
        }
        throw new Error('Erro ao carregar analytics');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Erro ao carregar dados de analytics');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod, router]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const exportCSV = () => {
    if (!data) return;

    // Export Top Articles
    const csvRows = [
      ['Artigo', 'Perguntas'],
      ...data.topArticles.map((a) => [a.articleNumber, a.questionsCount]),
    ];

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `lei-14133-analytics-${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="p-6 bg-red-50 border-2 border-red-200 rounded-lg max-w-md">
            <p className="text-red-800 font-medium">{error || 'Erro desconhecido'}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  const maxQuestions = Math.max(...data.topArticles.map((a) => a.questionsCount), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/admin/lei-14133"
              className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Voltar</span>
            </Link>
            <div className="flex items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="7" className="text-gray-900">
                  Últimos 7 dias
                </option>
                <option value="30" className="text-gray-900">
                  Últimos 30 dias
                </option>
                <option value="90" className="text-gray-900">
                  Últimos 90 dias
                </option>
              </select>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">Analytics - Chat Lei 14.133</h1>
              <p className="text-white/90">
                Métricas e insights sobre o uso do chat IA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="w-8 h-8 text-purple-600" />
              <span className="text-3xl font-bold text-gray-900">
                {data.overview.totalQuestions}
              </span>
            </div>
            <p className="text-gray-600 font-medium">Total de Perguntas</p>
            <p className="text-sm text-gray-500 mt-1">
              {data.overview.feedbackRate}% com feedback
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-2 border-green-200">
            <div className="flex items-center justify-between mb-2">
              <ThumbsUp className="w-8 h-8 text-green-600" />
              <span className="text-3xl font-bold text-gray-900">
                {data.overview.satisfactionRate}%
              </span>
            </div>
            <p className="text-gray-600 font-medium">Taxa de Satisfação</p>
            <p className="text-sm text-gray-500 mt-1">
              {data.overview.positiveFeedback} positivos / {data.overview.negativeFeedback}{' '}
              negativos
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-blue-600" />
              <span className="text-3xl font-bold text-gray-900">
                {data.overview.avgLatency}ms
              </span>
            </div>
            <p className="text-gray-600 font-medium">Latência Média</p>
            <p className="text-sm text-gray-500 mt-1">
              Cache: {data.overview.cacheHitRate}%
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-2 border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-8 h-8 text-orange-600" />
              <span className="text-3xl font-bold text-gray-900">
                {(data.overview.totalTokens / 1000).toFixed(1)}k
              </span>
            </div>
            <p className="text-gray-600 font-medium">Tokens Totais</p>
            <p className="text-sm text-gray-500 mt-1">
              Média: {data.overview.avgTokens} tokens
            </p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Top Articles */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Artigos Mais Perguntados
              </h2>
            </div>

            <div className="space-y-4">
              {data.topArticles.map((article, index) => (
                <div key={article.articleNumber} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-700 font-bold rounded-full text-sm">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-gray-900">
                        Artigo {article.articleNumber}
                      </span>
                    </div>
                    <span className="text-gray-700 font-medium">
                      {article.questionsCount} perguntas
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                      style={{
                        width: `${(article.questionsCount / maxQuestions) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Questions by Day */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Perguntas nos Últimos 7 Dias
              </h2>
            </div>

            <div className="space-y-3">
              {data.questionsByDay.map((day) => {
                const maxDay = Math.max(
                  ...data.questionsByDay.map((d) => d.count),
                  1
                );
                const date = new Date(day.date);
                const dateLabel = date.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                });

                return (
                  <div key={day.date} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">{dateLabel}</span>
                      <span className="text-gray-900 font-semibold">
                        {day.count} perguntas
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${(day.count / maxDay) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Usuários Mais Ativos</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold">
                    #
                  </th>
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold">
                    Nome
                  </th>
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold">
                    Email
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold">
                    Perguntas
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topUsers.map((user, index) => (
                  <tr
                    key={user.userId}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-700 font-bold rounded-full text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {user.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{user.email}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      {user.questionsCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Questions */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Perguntas Recentes</h2>
          </div>

          <div className="space-y-4">
            {data.recentQuestions.map((q) => (
              <div
                key={q.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded">
                        Art. {q.articleNumber}
                      </span>
                      {q.wasHelpful !== null && (
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            q.wasHelpful
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {q.wasHelpful ? '👍 Útil' : '👎 Não útil'}
                        </span>
                      )}
                      {q.cached && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          ⚡ Cached
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 font-medium mb-2">{q.question}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{q.user.name}</span>
                      <span>•</span>
                      <span>
                        {new Date(q.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {q.latency && (
                        <>
                          <span>•</span>
                          <span>{q.latency}ms</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
