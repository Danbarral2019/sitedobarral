'use client';

import { useState, useEffect } from 'react';
import { Scale, FileText, TrendingUp, ChevronRight, Loader2, AlertTriangle, MessageSquare, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface TopArticle {
  numero: string;
  ementa: string;
  titulo: string;
  documentCount: number;
  viewCount: number;
}

interface WidgetData {
  topArticles: TopArticle[];
  totalArticles: number;
  totalDocuments: number;
  coveragePercent: number;
}

export default function LeiExplorerWidget() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WidgetData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/analytics/top-articles?limit=3');

        if (!response.ok) {
          throw new Error('Erro ao carregar artigos populares');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('[Lei Explorer Widget] Erro:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Se dismissed ou erro persistente, não renderizar
  if (dismissed || (error && !loading)) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-brand-50 to-brand-100 border-2 border-brand-200 rounded-xl p-6 shadow-md">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          <span className="text-brand-700">Carregando estatísticas da Lei 14.133...</span>
        </div>
      </div>
    );
  }

  // Error fallback (silencioso - não mostra widget se falhar)
  if (!data) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-brand-50 to-brand-100 border-2 border-brand-200 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 text-white p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/20 rounded-lg">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Lei 14.133/2021 Comentada</h2>
            <p className="text-brand-100 text-sm">
              Explore a lei organizada por artigos com documentos vinculados
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-xs text-brand-100 mb-1">Artigos</p>
            <p className="text-2xl font-bold">{data.totalArticles}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-xs text-brand-100 mb-1">Documentos</p>
            <p className="text-2xl font-bold">{data.totalDocuments}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-xs text-brand-100 mb-1">Cobertura</p>
            <p className="text-2xl font-bold">{data.coveragePercent}%</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* NEW Features Banner */}
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-purple-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-bold text-purple-900">Novidades!</h4>
                <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                  NOVO
                </span>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span><strong>Chat com IA:</strong> Faça perguntas sobre qualquer artigo da Lei 14.133</span>
                </li>
                <li className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span><strong>Busca Unificada:</strong> Busque em documentos E artigos simultaneamente</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Top Articles */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">Artigos Mais Acessados</h3>
          </div>

          <div className="space-y-3">
            {data.topArticles.map((article, index) => (
              <Link
                key={article.numero}
                href={`/area-restrita/lei-comentada?artigo=${article.numero}`}
                className="flex items-start gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                {/* Ranking Badge */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0
                      ? 'bg-yellow-400 text-yellow-900'
                      : index === 1
                      ? 'bg-gray-300 text-gray-700'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {index + 1}º
                </div>

                {/* Article Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                      Art. {article.numero}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1 border border-purple-300">
                      <MessageSquare className="w-3 h-3" />
                      Chat IA
                    </span>
                    {article.titulo && (
                      <span className="text-xs text-gray-600 truncate">{article.titulo}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2 mb-2">{article.ementa}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>{article.documentCount} docs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>{article.viewCount} acessos</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-600 flex-shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/area-restrita/lei-comentada"
          className="block w-full px-6 py-4 bg-gradient-to-r from-brand-600 to-brand-800 text-white text-center rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all shadow-md hover:shadow-lg font-semibold flex items-center justify-center gap-2"
        >
          <Scale className="w-5 h-5" />
          Explorar Lei 14.133 Completa
          <ChevronRight className="w-5 h-5" />
        </Link>

        {/* Helper Text */}
        <p className="text-xs text-center text-gray-600 mt-3">
          Navegue pela estrutura hierárquica da lei com todos os 195 artigos organizados
        </p>
      </div>
    </div>
  );
}
