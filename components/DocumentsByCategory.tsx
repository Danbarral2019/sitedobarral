'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Video, Heart } from 'lucide-react';
import { ArticleBadges } from './ArticleBadges';

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  type: string;
  url?: string;
  leiArticles?: string | null;
}

interface DocumentsByCategoryProps {
  documents: Document[];
  courseId: string;
  onDocumentClick: (doc: Document) => void;
  isFavorite: (docId: string) => boolean;
  toggleFavorite: (docId: string, courseId: string) => void;
}

// Categorias que devem ser agrupadas sob "Pareceres"
const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor'];

// Labels de subtipo para badges de pareceres
const PARECER_SUBTYPE_LABELS: Record<string, string | null> = {
  'parecer': null, // parecer comum — sem badge
  'parecer-vinculante': 'Vinculante',
  'decor': 'DECOR',
};

// Mapeamento de categorias para ícones e cores
const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  'acordao': { icon: '⚖️', color: 'blue', label: 'Acórdãos' },
  'pareceres': { icon: '📝', color: 'green', label: 'Pareceres' },
  'orientacao-normativa': { icon: '📋', color: 'indigo', label: 'Orientações Normativas' },
  'instrucao-normativa': { icon: '📄', color: 'indigo', label: 'Instruções Normativas' },
  'portaria': { icon: '📜', color: 'emerald', label: 'Portarias' },
  'decreto': { icon: '📋', color: 'blue', label: 'Decretos' },
  'lei': { icon: '⚖️', color: 'purple', label: 'Leis' },
  'resolucao': { icon: '📜', color: 'cyan', label: 'Resoluções' },
  'artigo': { icon: '📑', color: 'purple', label: 'Artigos' },
  'edital': { icon: '📰', color: 'orange', label: 'Editais' },
  'apostila': { icon: '📖', color: 'indigo', label: 'Apostilas' },
  'link': { icon: '🔗', color: 'cyan', label: 'Links' },
  'video': { icon: '🎥', color: 'red', label: 'Vídeos' },
  'enunciados': { icon: '📋', color: 'purple', label: 'Enunciados' },
  'sumula': { icon: '⚖️', color: 'indigo', label: 'Súmulas' },
  'outros': { icon: '📄', color: 'gray', label: 'Outros' },
  'outro': { icon: '📄', color: 'gray', label: 'Outros' }, // Fallback para singular
};

export default function DocumentsByCategory({
  documents,
  courseId,
  onDocumentClick,
  isFavorite,
  toggleFavorite,
}: DocumentsByCategoryProps) {
  // Estado de expansão por categoria
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Agrupar documentos por categoria (excluindo materiais destacados)
  // Pareceres (parecer, parecer-vinculante, decor) são agrupados sob "pareceres"
  const documentsByCategory = documents.reduce((acc, doc) => {
    // Pular materiais destacados
    if (['apostila', 'conteudo-programatico', 'bibliografia'].includes(doc.category)) {
      return acc;
    }

    const displayCategory = PARECER_CATEGORIES.includes(doc.category)
      ? 'pareceres'
      : doc.category;

    if (!acc[displayCategory]) {
      acc[displayCategory] = [];
    }
    acc[displayCategory].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  // Ordenar categorias alfabeticamente
  const sortedCategories = Object.keys(documentsByCategory).sort();

  // Toggle de expansão
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Truncar descrição
  const truncateDescription = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  if (sortedCategories.length === 0) {
    return (
      <div className="bg-brand-50 border-2 border-brand-200 rounded-xl p-6 lg:p-6 text-center">
        <p className="text-base lg:text-lg text-brand-800 font-medium">
          Não há outros documentos disponíveis para este curso no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 lg:p-8 border-2 border-gray-200">
      <div className="mb-4 lg:mb-6">
        <h2 className="text-base lg:text-2xl font-bold text-gray-900 mb-1 lg:mb-2">📚 Materiais por Categoria</h2>
        <p className="text-sm lg:text-base text-gray-600">Clique em um documento para ver detalhes completos</p>
      </div>

      <div className="space-y-3 lg:space-y-4">
        {sortedCategories.map((category) => {
          const categoryDocs = documentsByCategory[category];
          const isExpanded = expandedCategories.has(category);
          const config = categoryConfig[category] || categoryConfig['outro'];
          const colorClasses = {
            blue: 'border-brand-200 bg-brand-50',
            green: 'border-green-200 bg-green-50',
            purple: 'border-purple-200 bg-purple-50',
            orange: 'border-orange-200 bg-orange-50',
            indigo: 'border-indigo-200 bg-indigo-50',
            cyan: 'border-cyan-200 bg-cyan-50',
            red: 'border-red-200 bg-red-50',
            gray: 'border-gray-200 bg-gray-50',
          };

          return (
            <div
              key={category}
              className={`border-2 rounded-xl overflow-hidden transition-all ${colorClasses[config.color as keyof typeof colorClasses]}`}
            >
              {/* Header da categoria */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 lg:p-4 hover:opacity-80 transition-opacity min-h-[56px] lg:min-h-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl lg:text-2xl">{config.icon}</span>
                  <div className="text-left">
                    <h3 className="text-base lg:text-lg font-bold text-gray-900">{config.label}</h3>
                    <p className="text-sm lg:text-sm text-gray-600">{categoryDocs.length} documento{categoryDocs.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="text-gray-600">
                  {isExpanded ? (
                    <ChevronUp className="w-6 h-6 lg:w-6 lg:h-6" />
                  ) : (
                    <ChevronDown className="w-6 h-6 lg:w-6 lg:h-6" />
                  )}
                </div>
              </button>

              {/* Lista de documentos - sempre mostra preview dos primeiros 2 */}
              <div className="border-t-2 border-gray-200">
                {(isExpanded ? categoryDocs : categoryDocs.slice(0, 2)).map((doc, index) => (
                    <div
                      key={doc.id}
                      className={`p-3 lg:p-4 hover:bg-white/50 transition-colors ${
                        index < categoryDocs.length - 1 ? 'border-b border-gray-200' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Conteúdo do documento */}
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => onDocumentClick(doc)}
                            className="text-left w-full group min-h-[44px] lg:min-h-[48px] flex items-start"
                          >
                            <div className="flex items-start gap-2 lg:gap-3 w-full">
                              <div className="w-8 h-8 lg:w-8 lg:h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                {doc.type === 'video' ? (
                                  <Video className="w-4 h-4 lg:w-4 lg:h-4 text-white" />
                                ) : (
                                  <FileText className="w-4 h-4 lg:w-4 lg:h-4 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start gap-2">
                                  <h4 className="text-sm lg:text-base font-bold text-gray-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                                    {doc.title}
                                  </h4>
                                  {PARECER_SUBTYPE_LABELS[doc.category] && (
                                    <span className={`flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                      doc.category === 'decor'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {PARECER_SUBTYPE_LABELS[doc.category]}
                                    </span>
                                  )}
                                </div>
                                {doc.description && (
                                  <p className="text-xs lg:text-sm text-gray-600 mt-0.5 lg:mt-1 line-clamp-2">
                                    {truncateDescription(doc.description)}
                                  </p>
                                )}
                                {/* Badges de artigos da Lei 14.133 */}
                                {doc.leiArticles && (
                                  <div className="mt-2">
                                    <ArticleBadges
                                      leiArticles={doc.leiArticles}
                                      maxVisible={3}
                                      onArticleClick={(articleNum) => {
                                        // Click na badge abre o documento - não precisa ação extra
                                        console.log('Artigo clicado:', articleNum);
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* Botão de favoritar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(doc.id, courseId);
                          }}
                          className={`p-2 lg:p-2 rounded-lg transition-colors flex-shrink-0 min-h-[40px] min-w-[40px] lg:min-h-0 lg:min-w-0 flex items-center justify-center ${
                            isFavorite(doc.id)
                              ? 'text-red-600 bg-red-100 hover:bg-red-200'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={isFavorite(doc.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        >
                          <Heart className={`w-5 h-5 lg:w-5 lg:h-5 ${isFavorite(doc.id) ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  ))}

                {/* Indicador de mais documentos */}
                {!isExpanded && categoryDocs.length > 2 && (
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full text-center text-sm font-medium text-brand-600 hover:text-brand-800 flex items-center justify-center gap-2"
                    >
                      <span>Ver mais {categoryDocs.length - 2} {categoryDocs.length - 2 === 1 ? 'documento' : 'documentos'}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dica */}
      <div className="mt-6 p-4 lg:p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm lg:text-sm text-gray-700 leading-relaxed">
          💡 <strong>Dica:</strong> Clique em qualquer documento para ver a descrição completa e fazer o download.
        </p>
      </div>
    </div>
  );
}
