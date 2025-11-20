'use client';

import { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, FileText, TrendingUp, ChevronRight, Loader2, X } from 'lucide-react';

interface CoverageStats {
  totalArtigos: number;
  artigosComDocumentos: number;
  percentualCobertura: number;
  totalDocumentosCatalogados: number;
  artigosOrfaos: {
    numero: string;
    ementa: string;
    titulo: string;
    documentos: number;
  }[];
  artigosPoucos: {
    numero: string;
    ementa: string;
    titulo: string;
    documentos: number;
  }[];
  distribuicaoPorTitulo: {
    titulo: string;
    artigos: number;
    comDocs: number;
    totalDocs: number;
    cobertura: number;
  }[];
}

export default function LeiCoverageDashboard() {
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/admin/analytics/lei-cobertura');

        if (!response.ok) {
          throw new Error('Erro ao carregar estatísticas');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('[LeiCoverageDashboard] Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (dismissed) return null;

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-indigo-700">Carregando estatísticas da Lei 14.133...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700">Erro ao carregar estatísticas: {error}</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-600 hover:text-red-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const coverageColor =
    stats.percentualCobertura >= 80
      ? 'text-green-700 bg-green-100'
      : stats.percentualCobertura >= 60
      ? 'text-blue-700 bg-blue-100'
      : stats.percentualCobertura >= 40
      ? 'text-orange-700 bg-orange-100'
      : 'text-red-700 bg-red-100';

  const progressBarColor =
    stats.percentualCobertura >= 80
      ? 'bg-green-500'
      : stats.percentualCobertura >= 60
      ? 'bg-blue-500'
      : stats.percentualCobertura >= 40
      ? 'bg-orange-500'
      : 'bg-red-500';

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-6 mb-6 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-indigo-900">Cobertura da Lei 14.133/2021</h2>
            <p className="text-sm text-indigo-600">
              Estatísticas de catalogação dos artigos da lei
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Percentual de Cobertura */}
        <div className="bg-white rounded-lg p-4 border border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Cobertura</span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${coverageColor}`}>
              {stats.percentualCobertura}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${progressBarColor} transition-all duration-500`}
              style={{ width: `${stats.percentualCobertura}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {stats.artigosComDocumentos} de {stats.totalArtigos} artigos com documentos
          </p>
        </div>

        {/* Total de Documentos Catalogados */}
        <div className="bg-white rounded-lg p-4 border border-indigo-200">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-600">Documentos</span>
          </div>
          <p className="text-3xl font-bold text-purple-900">{stats.totalDocumentosCatalogados}</p>
          <p className="text-xs text-gray-600 mt-1">vinculados à Lei 14.133</p>
        </div>

        {/* Artigos Órfãos */}
        <div className="bg-white rounded-lg p-4 border border-red-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-gray-600">Artigos Órfãos</span>
          </div>
          <p className="text-3xl font-bold text-red-900">{stats.artigosOrfaos.length}</p>
          <p className="text-xs text-gray-600 mt-1">sem nenhum documento</p>
        </div>
      </div>

      {/* Prioridades de Catalogação */}
      {stats.artigosOrfaos.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-amber-200 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              🎯 Prioridades para Catalogação
            </h3>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 transition-colors"
            >
              {expanded ? 'Ocultar' : 'Ver todos'}
              <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          </div>

          <div className="space-y-2">
            {(expanded ? stats.artigosOrfaos : stats.artigosOrfaos.slice(0, 3)).map((artigo) => (
              <div
                key={artigo.numero}
                className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <div className="flex-shrink-0">
                  <span className="inline-block px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-full">
                    Art. {artigo.numero}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{artigo.ementa}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{artigo.titulo}</p>
                </div>
                <span className="flex-shrink-0 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                  0 docs
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Artigos Carentes (1-2 documentos) */}
      {stats.artigosPoucos.length > 0 && expanded && (
        <div className="bg-white rounded-lg p-4 border border-orange-200 mb-4">
          <h3 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Artigos com Poucos Documentos
          </h3>
          <div className="space-y-2">
            {stats.artigosPoucos.slice(0, 5).map((artigo) => (
              <div
                key={artigo.numero}
                className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200"
              >
                <span className="inline-block px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-full">
                  Art. {artigo.numero}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{artigo.ementa}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{artigo.titulo}</p>
                </div>
                <span className="flex-shrink-0 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                  {artigo.documentos} {artigo.documentos === 1 ? 'doc' : 'docs'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distribuição por Título (expandido) */}
      {expanded && stats.distribuicaoPorTitulo.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-indigo-200">
          <h3 className="text-sm font-semibold text-indigo-900 mb-3">Distribuição por Título da Lei</h3>
          <div className="space-y-3">
            {stats.distribuicaoPorTitulo.map((titulo) => (
              <div key={titulo.titulo} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{titulo.titulo}</span>
                  <span className="text-xs text-gray-600">
                    {titulo.comDocs}/{titulo.artigos} artigos ({titulo.cobertura}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${titulo.cobertura}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">{titulo.totalDocs} documentos catalogados</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer com Botões */}
      <div className="flex gap-3 mt-4 pt-4 border-t border-indigo-200">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
        >
          {expanded ? 'Ocultar Detalhes' : 'Ver Relatório Completo'}
        </button>
        <a
          href="/admin/lei-14133"
          className="px-4 py-2 bg-white text-indigo-700 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors font-medium text-sm"
        >
          Gerenciar Artigos →
        </a>
      </div>
    </div>
  );
}
