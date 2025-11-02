'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, FileText, Eye } from 'lucide-react';
import { formatArticleNumber, getArticleIcon } from '@/lib/article-utils';
import type { LeiArticle } from '@/data/lei-14133-artigos';

interface TopArticle {
  numero: string;
  article: LeiArticle;
  documentCount: number;
  viewCount: number;
}

interface TopArticlesWidgetProps {
  limit?: number;
  showStats?: boolean;
  onArticleClick?: (articleNumber: string) => void;
}

export function TopArticlesWidget({
  limit = 10,
  showStats = true,
  onArticleClick
}: TopArticlesWidgetProps) {
  const [articles, setArticles] = useState<TopArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopArticles = async () => {
      try {
        const response = await fetch(`/api/analytics/top-articles?limit=${limit}`);
        if (response.ok) {
          const data = await response.json();
          setArticles(data.articles || []);
        }
      } catch (error) {
        console.error('Erro ao buscar top artigos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopArticles();
  }, [limit]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">
            Top {limit} Artigos Mais Consultados
          </h3>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">
            Top {limit} Artigos Mais Consultados
          </h3>
        </div>
        <p className="text-gray-600 text-sm">
          Nenhum artigo catalogado ainda. Comece a indexar documentos!
        </p>
      </div>
    );
  }

  const handleClick = (articleNum: string) => {
    if (onArticleClick) {
      onArticleClick(articleNum);
    }
  };

  // Determina cor da medalha
  const getMedalColor = (position: number): string => {
    if (position === 1) return 'text-yellow-500'; // Ouro
    if (position === 2) return 'text-gray-400';   // Prata
    if (position === 3) return 'text-orange-600'; // Bronze
    return 'text-gray-300';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">
            Top {limit} Artigos Mais Consultados
          </h3>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Artigos da Lei 14.133/2021 com mais materiais e acessos
        </p>
      </div>

      {/* Lista */}
      <div className="divide-y divide-gray-100">
        {articles.map((item, index) => {
          const position = index + 1;
          const showMedal = position <= 3;

          return (
            <button
              key={item.numero}
              onClick={() => handleClick(item.numero)}
              className="w-full text-left p-4 hover:bg-blue-50 transition-colors duration-150 group"
            >
              <div className="flex items-start gap-4">
                {/* Posição / Medalha */}
                <div className="flex-shrink-0 w-8 text-center">
                  {showMedal ? (
                    <span className={`text-2xl ${getMedalColor(position)}`}>
                      {position === 1 && '🥇'}
                      {position === 2 && '🥈'}
                      {position === 3 && '🥉'}
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-gray-400">
                      {position}
                    </span>
                  )}
                </div>

                {/* Ícone */}
                <div className="flex-shrink-0 text-2xl mt-0.5">
                  {getArticleIcon(item.numero)}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {formatArticleNumber(item.numero)}
                    </span>
                    {item.article.secao && (
                      <span className="text-xs text-gray-500 truncate">
                        {item.article.secao}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                    {item.article.ementa}
                  </p>

                  {/* Estatísticas */}
                  {showStats && (
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        <span>
                          <strong className="text-gray-900">{item.documentCount}</strong> documentos
                        </span>
                      </div>
                      {item.viewCount > 0 && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          <span>
                            <strong className="text-gray-900">{item.viewCount}</strong> visualizações
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
        <p className="text-xs text-gray-600 text-center">
          💡 Clique em um artigo para filtrar documentos relacionados
        </p>
      </div>
    </div>
  );
}
