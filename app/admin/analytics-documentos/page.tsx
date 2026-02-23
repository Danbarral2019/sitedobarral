'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  FileText,
  Hash,
  Scale,
  Loader2,
  AlertCircle,
  Database,
  Layers,
  TrendingUp,
  BookOpen
} from 'lucide-react';

interface AnalyticsStats {
  totalAnalyzed: number;
  totalArticleRefs: number;
  avgArticlesPerDoc: number;
  uniqueArticles: number;
  topArticles: Array<{ article: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
}

interface RecentAnalysis {
  id: string;
  title: string;
  source: string;
  category: string;
  articleCount: number;
  articles: string[];
  updatedAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  Document: 'Documentos',
  LegislativeAct: 'Atos Legislativos',
  DOUStaging: 'DOU Staging',
};

const SOURCE_COLORS: Record<string, string> = {
  Document: 'bg-blue-100 text-blue-700',
  LegislativeAct: 'bg-purple-100 text-purple-700',
  DOUStaging: 'bg-amber-100 text-amber-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  acordao: 'Acórdãos TCU',
  parecer: 'Pareceres',
  on: 'Orientações Normativas',
  enunciado: 'Enunciados',
  decreto: 'Decretos',
  portaria: 'Portarias',
  in: 'Instruções Normativas',
  lei: 'Leis',
  legislacao: 'Legislação',
  'ordem-servico': 'Ordens de Serviço',
  'medida-provisoria': 'Medidas Provisórias',
  dou: 'DOU',
  apostila: 'Apostilas',
  artigo: 'Artigos',
  outro: 'Outros',
  decor: 'DECOR',
  manual: 'Manuais',
};

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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Carregando analytics...</p>
          </div>
        </div>
    );
  }

  if (error || !stats) {
    return (
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
    );
  }

  return (
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Analytics — Indexação de Artigos da Lei 14.133
          </h1>
          <p className="text-gray-600">
            Visão geral da indexação automática de artigos da Lei 14.133/2021 em documentos, atos legislativos e DOU
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Docs Indexados</span>
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalAnalyzed}</p>
            <p className="text-xs text-gray-500 mt-1">com artigos da Lei 14.133</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Referências Totais</span>
              <Hash className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalArticleRefs}</p>
            <p className="text-xs text-gray-500 mt-1">artigos vinculados</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Artigos Distintos</span>
              <Scale className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.uniqueArticles}</p>
            <p className="text-xs text-gray-500 mt-1">de 195 artigos da Lei</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Média por Doc</span>
              <TrendingUp className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.avgArticlesPerDoc}</p>
            <p className="text-xs text-gray-500 mt-1">artigos por documento</p>
          </div>
        </div>

        {/* Source and Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* By Source */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Por Fonte</h2>
            </div>
            <div className="space-y-3">
              {stats.bySource.map(({ source, count }) => (
                <div key={source} className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${SOURCE_COLORS[source] || 'bg-gray-100 text-gray-700'}`}>
                    {SOURCE_LABELS[source] || source}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min((count / stats.totalAnalyzed) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 w-12 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By Category */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Por Categoria</h2>
            </div>
            <div className="space-y-2">
              {stats.byCategory.slice(0, 10).map(({ category, count }) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {CATEGORY_LABELS[category] || category}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min((count / stats.byCategory[0].count) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 w-12 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Articles */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Artigos Mais Referenciados (Top 20)
            </h2>
          </div>
          {stats.topArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stats.topArticles.map((item, idx) => (
                <div key={item.article} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="flex-1 flex items-center justify-between">
                    <span className="font-medium text-gray-900">Art. {item.article}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min((item.count / stats.topArticles[0].count) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-600 w-8 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">Nenhum dado disponível</p>
          )}
        </div>

        {/* Recent Analyses Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Documentos Indexados Recentemente
          </h2>
          {recentAnalyses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-3 px-4 font-semibold text-gray-700">Documento</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Fonte</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Categoria</th>
                    <th className="py-3 px-4 font-semibold text-gray-700 text-center">Artigos</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Principais</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAnalyses.map((analysis) => (
                    <tr key={`${analysis.source}-${analysis.id}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 line-clamp-1">
                          {analysis.title}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${SOURCE_COLORS[analysis.source] || 'bg-gray-100 text-gray-700'}`}>
                          {SOURCE_LABELS[analysis.source] || analysis.source}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {CATEGORY_LABELS[analysis.category] || analysis.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-blue-600">{analysis.articleCount}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {analysis.articles.map((art) => (
                            <span
                              key={art}
                              className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
                            >
                              {art}
                            </span>
                          ))}
                          {analysis.articleCount > 5 && (
                            <span className="text-xs text-gray-400">
                              +{analysis.articleCount - 5}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(analysis.updatedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
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
      </div>
  );
}
