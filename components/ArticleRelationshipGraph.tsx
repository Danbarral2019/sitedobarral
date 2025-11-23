'use client';

import { useEffect, useState } from 'react';
import { Loader2, Network, Info, ArrowRight } from 'lucide-react';
import { LEI_14133_ARTIGOS } from '@/data/lei-14133-artigos';

interface ArticleRelationship {
  articleNumber: string;
  strength: number;
  sharedDocuments: number;
}

interface ArticleRelationshipGraphProps {
  articleNumber: string;
  onArticleClick?: (articleNumber: string) => void;
}

export function ArticleRelationshipGraph({
  articleNumber,
  onArticleClick,
}: ArticleRelationshipGraphProps) {
  const [relationships, setRelationships] = useState<ArticleRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRelationships = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artigos/${articleNumber}/relationships`);

      if (!response.ok) {
        throw new Error('Erro ao carregar relacionamentos');
      }

      const data = await response.json();

      if (!data.relationships || data.relationships.length === 0) {
        setRelationships([]);
        return;
      }

      // Pegar os top 12 relacionamentos mais fortes
      const topRelationships = data.relationships
        .sort((a: ArticleRelationship, b: ArticleRelationship) => b.strength - a.strength)
        .slice(0, 12);

      setRelationships(topRelationships);

      console.log('✅ Relacionamentos Carregados (v3.0 - Lista Rápida):', {
        total: topRelationships.length,
        artigos: topRelationships.map((r: ArticleRelationship) => `Art. ${r.articleNumber} (${r.strength}%)`).join(', ')
      });
    } catch (err) {
      console.error('Erro ao carregar relacionamentos:', err);
      setError('Não foi possível carregar o mapa de relacionamentos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRelationships();
  }, [articleNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Carregando mapa de relacionamentos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border-2 border-red-200 p-8">
        <div className="flex items-center justify-center text-red-600">
          <Info className="w-6 h-6 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (relationships.length === 0) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
        <div className="flex items-center justify-center text-gray-500">
          <Network className="w-6 h-6 mr-2" />
          <span>Nenhum relacionamento encontrado para este artigo</span>
        </div>
      </div>
    );
  }

  const getColorByStrength = (strength: number): string => {
    if (strength >= 75) return 'bg-red-500 text-red-100';
    if (strength >= 50) return 'bg-orange-500 text-orange-100';
    if (strength >= 25) return 'bg-yellow-500 text-yellow-100';
    return 'bg-green-500 text-green-100';
  };

  const getBadgeColor = (strength: number): string => {
    if (strength >= 75) return 'bg-red-100 text-red-700 border-red-300';
    if (strength >= 50) return 'bg-orange-100 text-orange-700 border-orange-300';
    if (strength >= 25) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-green-100 text-green-700 border-green-300';
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Artigos Relacionados
              </h3>
              <p className="text-sm text-gray-600">
                Top {relationships.length} artigos mais citados juntos
              </p>
            </div>
          </div>
          <div className="px-3 py-1 bg-green-100 border border-green-300 rounded-full">
            <span className="text-xs font-bold text-green-700">v3.0 - Rápido</span>
          </div>
        </div>
      </div>

      {/* Lista de Artigos Relacionados */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {relationships.map((rel) => {
            const article = LEI_14133_ARTIGOS[rel.articleNumber];
            return (
              <button
                key={rel.articleNumber}
                onClick={() => onArticleClick && onArticleClick(rel.articleNumber)}
                className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-300 rounded-lg transition-all text-left group"
              >
                {/* Indicador de Força */}
                <div className={`flex-shrink-0 w-12 h-12 ${getColorByStrength(rel.strength)} rounded-lg flex flex-col items-center justify-center font-bold`}>
                  <div className="text-lg">{rel.strength}%</div>
                </div>

                {/* Informações do Artigo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-gray-900 text-base">
                      Art. {rel.articleNumber}
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getBadgeColor(rel.strength)}`}>
                      {rel.sharedDocuments} {rel.sharedDocuments === 1 ? 'doc' : 'docs'}
                    </span>
                  </div>
                  {article && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {article.ementa}
                    </p>
                  )}
                </div>

                {/* Ícone de Navegação */}
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 flex-shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h4 className="text-xs font-bold text-gray-700 mb-2">Força do Relacionamento:</h4>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-600">Muito Forte (≥75%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-gray-600">Forte (50-74%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-600">Moderado (25-49%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-600">Fraco (&lt;25%)</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-600">
              💡 Clique em um artigo para navegar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
