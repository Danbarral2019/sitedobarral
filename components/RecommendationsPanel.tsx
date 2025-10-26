'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, FileText, BookOpen, Lightbulb } from 'lucide-react';
import { formatRecommendationReason } from '@/lib/recommendations';

interface DocumentRecommendation {
  id: string;
  title: string;
  score: number;
  reason: string[];
  document: {
    description: string | null;
    category: string;
    type: string;
    isPublic: boolean;
    url: string | null;
  } | null;
}

interface BlogPostRecommendation {
  id: string;
  title: string;
  score: number;
  reason: string[];
  post: {
    slug: string;
    excerpt: string;
    author: string;
    publishedAt: Date;
  } | null;
}

interface ArticleRecommendation {
  numero: string;
  ementa: string;
  capitulo: string;
  secao: string | null;
}

type RecommendationType = 'document' | 'blog-post' | 'article';

interface RecommendationsPanelProps {
  type: RecommendationType;
  sourceId: string;
  title?: string;
  maxItems?: number;
  variant?: 'compact' | 'detailed';
}

export default function RecommendationsPanel({
  type,
  sourceId,
  title,
  maxItems = 5,
  variant = 'detailed'
}: RecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, [sourceId, type]);

  const loadRecommendations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let endpoint = '';
      switch (type) {
        case 'document':
          endpoint = `/api/recommendations/documents/${sourceId}?limit=${maxItems}`;
          break;
        case 'blog-post':
          endpoint = `/api/recommendations/blog-posts/${sourceId}?limit=${maxItems}`;
          break;
        case 'article':
          endpoint = `/api/recommendations/articles/${sourceId}?limit=${maxItems}`;
          break;
      }

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Falha ao carregar recomendações');

      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error('Erro ao carregar recomendações:', err);
      setError('Não foi possível carregar recomendações');
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'document':
        return '📄 Documentos Relacionados';
      case 'blog-post':
        return '📝 Posts Relacionados';
      case 'article':
        return '📚 Artigos Relacionados';
      default:
        return 'Recomendações';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Não mostra nada se não houver recomendações
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border-2 border-blue-200">
      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-blue-600" />
        {title || getDefaultTitle()}
      </h3>

      <div className="space-y-3">
        {recommendations.map((rec, index) => {
          // Renderiza diferentes tipos de recomendações
          if (type === 'article') {
            return (
              <Link
                key={rec.numero}
                href={`/artigo/${rec.numero}`}
                className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border-2 border-transparent hover:border-blue-300"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                    {rec.numero}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 mb-1 text-sm">
                      Artigo {rec.numero}
                    </h4>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {rec.ementa}
                    </p>
                  </div>
                </div>
              </Link>
            );
          }

          if (type === 'blog-post' && rec.post) {
            return (
              <Link
                key={rec.id}
                href={`/blog/${rec.post.slug}`}
                className="block p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors border-2 border-transparent hover:border-purple-300"
              >
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 mb-1 text-sm">
                      {rec.title}
                    </h4>
                    {variant === 'detailed' && (
                      <>
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                          {rec.post.excerpt}
                        </p>
                        {rec.reason && rec.reason.length > 0 && (
                          <div className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded inline-block">
                            💡 {formatRecommendationReason(rec.reason)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          }

          if (type === 'document' && rec.document) {
            return (
              <div
                key={rec.id}
                className="p-4 bg-green-50 rounded-lg border-2 border-transparent hover:border-green-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 mb-1 text-sm">
                      {rec.title}
                    </h4>
                    {variant === 'detailed' && (
                      <>
                        {rec.document.description && (
                          <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                            {rec.document.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            rec.document.isPublic
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {rec.document.isPublic ? 'Público' : 'Restrito'}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">
                            {rec.document.category}
                          </span>
                          {rec.reason && rec.reason.length > 0 && (
                            <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                              💡 {formatRecommendationReason(rec.reason)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {recommendations.length >= maxItems && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Mostrando {recommendations.length} recomendações mais relevantes
          </p>
        </div>
      )}
    </div>
  );
}
