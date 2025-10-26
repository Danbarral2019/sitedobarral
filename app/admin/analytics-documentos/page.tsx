'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { BarChart3, TrendingUp, Target, Sparkles, FileText, Hash, Tag, Loader2, AlertCircle } from 'lucide-react';

interface AnalyticsStats {
  totalAnalyses: number;
  avgPrecision: number;
  avgSuggestions: number;
  avgAccepted: number;
  totalCitations: number;
  totalKeywords: number;
  mostSuggestedArticles: Array<{ article: string; count: number }>;
  mostAcceptedArticles: Array<{ article: string; count: number }>;
}

interface RecentAnalysis {
  id: string;
  documentTitle: string;
  documentType: string | null;
  totalSuggestions: number;
  acceptedCount: number;
  precision: number | null;
  citationsFound: number;
  keywordsMatched: number;
  createdAt: string;
}

export default function AnalyticsDocumentosPage() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/analytics/document-analysis');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar analytics');
      }

      setStats(data.stats);
      setRecentAnalyses(data.recentAnalyses);
    } catch (error) {
      console.error('Erro ao buscar analytics:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Carregando analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !stats) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <p className="text-red-600 font-medium mb-2">Erro ao carregar analytics</p>
            <p className="text-gray-600 text-sm">{error || 'Dados não encontrados'}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Analytics - Análise Automática de Documentos
          </h1>
          <p className="text-gray-600">
            Desempenho do sistema de sugestão automática de artigos da Lei 14.133/2021
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Analyses */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total de Análises</span>
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalAnalyses}</p>
            <p className="text-xs text-gray-500 mt-1">documentos analisados</p>
          </div>

          {/* Average Precision */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Precisão Média</span>
              <Target className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.avgPrecision ? `${stats.avgPrecision.toFixed(1)}%` : 'N/A'}
            </p>
            <p className="text-xs text-gray-500 mt-1">sugestões aceitas</p>
          </div>

          {/* Average Suggestions */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Sugestões Média</span>
              <Sparkles className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.avgSuggestions ? stats.avgSuggestions.toFixed(1) : '0'}
            </p>
            <p className="text-xs text-gray-500 mt-1">artigos por análise</p>
          </div>

          {/* Average Accepted */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Aceites Média</span>
              <TrendingUp className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.avgAccepted ? stats.avgAccepted.toFixed(1) : '0'}
            </p>
            <p className="text-xs text-gray-500 mt-1">artigos aceitos</p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Citações Detectadas</h2>
            </div>
            <p className="text-4xl font-bold text-blue-600">{stats.totalCitations}</p>
            <p className="text-sm text-gray-500 mt-1">referências diretas a artigos encontradas</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Palavras-Chave Encontradas</h2>
            </div>
            <p className="text-4xl font-bold text-purple-600">{stats.totalKeywords}</p>
            <p className="text-sm text-gray-500 mt-1">termos jurídicos identificados</p>
          </div>
        </div>

        {/* Top Articles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Most Suggested */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Artigos Mais Sugeridos (Top 10)
            </h2>
            {stats.mostSuggestedArticles.length > 0 ? (
              <div className="space-y-3">
                {stats.mostSuggestedArticles.map((item, idx) => (
                  <div key={item.article} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium text-gray-900">Art. {item.article}º</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min((item.count / stats.mostSuggestedArticles[0].count) * 100, 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-600 w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-8">Nenhum dado disponível</p>
            )}
          </div>

          {/* Most Accepted */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Artigos Mais Aceitos (Top 10)
            </h2>
            {stats.mostAcceptedArticles.length > 0 ? (
              <div className="space-y-3">
                {stats.mostAcceptedArticles.map((item, idx) => (
                  <div key={item.article} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium text-gray-900">Art. {item.article}º</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min((item.count / stats.mostAcceptedArticles[0].count) * 100, 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-600 w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-8">Nenhum dado disponível</p>
            )}
          </div>
        </div>

        {/* Recent Analyses Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Análises Recentes</h2>
          {recentAnalyses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-3 px-4 font-semibold text-gray-700">Documento</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Tipo</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 text-center">Sugestões</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 text-center">Aceites</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 text-center">Precisão</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 text-center">Citações</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 text-center">Keywords</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAnalyses.map((analysis) => (
                    <tr key={analysis.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{analysis.documentTitle}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {analysis.documentType || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-purple-600">{analysis.totalSuggestions}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-green-600">{analysis.acceptedCount}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {analysis.precision !== null ? (
                          <span className={`font-semibold ${
                            analysis.precision >= 70 ? 'text-green-600' :
                            analysis.precision >= 40 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {analysis.precision.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-gray-700">{analysis.citationsFound}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-gray-700">{analysis.keywordsMatched}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(analysis.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">Nenhuma análise encontrada</p>
          )}
        </div>

        {/* Footer Info */}
        {stats.totalAnalyses === 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-blue-900 font-medium mb-2">Sistema Pronto para Uso</p>
            <p className="text-blue-700 text-sm">
              O sistema de analytics está configurado e pronto. As estatísticas aparecerão aqui assim que você começar a usar
              a funcionalidade de análise automática no cadastro de documentos.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
