'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Video, Heart } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  type: string;
  url?: string;
}

interface DocumentsByCategoryProps {
  documents: Document[];
  courseId: string;
  onDocumentClick: (doc: Document) => void;
  isFavorite: (docId: string) => boolean;
  toggleFavorite: (docId: string, courseId: string) => void;
}

// Mapeamento de categorias para ícones e cores
const categoryConfig: Record<string, { icon: string; color: string; label: string }> = {
  'acordao': { icon: '⚖️', color: 'blue', label: 'Acórdãos' },
  'parecer': { icon: '📝', color: 'green', label: 'Pareceres' },
  'artigo': { icon: '📑', color: 'purple', label: 'Artigos' },
  'edital': { icon: '📰', color: 'orange', label: 'Editais' },
  'apostila': { icon: '📖', color: 'indigo', label: 'Apostilas' },
  'link': { icon: '🔗', color: 'cyan', label: 'Links' },
  'video': { icon: '🎥', color: 'red', label: 'Vídeos' },
  'outro': { icon: '📄', color: 'gray', label: 'Outros' },
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
  const documentsByCategory = documents.reduce((acc, doc) => {
    // Pular materiais destacados
    if (['apostila', 'conteudo-programatico', 'bibliografia'].includes(doc.category)) {
      return acc;
    }

    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
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
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
        <p className="text-blue-800 font-medium">
          Não há outros documentos disponíveis para este curso no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">📚 Materiais por Categoria</h2>
        <p className="text-gray-600">Clique em um documento para ver detalhes completos</p>
      </div>

      <div className="space-y-4">
        {sortedCategories.map((category) => {
          const categoryDocs = documentsByCategory[category];
          const isExpanded = expandedCategories.has(category);
          const config = categoryConfig[category] || categoryConfig['outro'];
          const colorClasses = {
            blue: 'border-blue-200 bg-blue-50',
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
                className="w-full flex items-center justify-between p-4 hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{config.icon}</span>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-900">{config.label}</h3>
                    <p className="text-sm text-gray-600">{categoryDocs.length} documento{categoryDocs.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="text-gray-600">
                  {isExpanded ? (
                    <ChevronUp className="w-6 h-6" />
                  ) : (
                    <ChevronDown className="w-6 h-6" />
                  )}
                </div>
              </button>

              {/* Lista de documentos (colapsável) */}
              {isExpanded && (
                <div className="border-t-2 border-gray-200">
                  {categoryDocs.map((doc, index) => (
                    <div
                      key={doc.id}
                      className={`p-4 hover:bg-white/50 transition-colors ${
                        index < categoryDocs.length - 1 ? 'border-b border-gray-200' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Conteúdo do documento */}
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => onDocumentClick(doc)}
                            className="text-left w-full group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                                {doc.type === 'video' ? (
                                  <Video className="w-4 h-4 text-white" />
                                ) : (
                                  <FileText className="w-4 h-4 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                                  {doc.title}
                                </h4>
                                {doc.description && (
                                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                    {truncateDescription(doc.description)}
                                  </p>
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
                          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                            isFavorite(doc.id)
                              ? 'text-red-600 bg-red-100 hover:bg-red-200'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={isFavorite(doc.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        >
                          <Heart className={`w-5 h-5 ${isFavorite(doc.id) ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dica */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-700">
          💡 <strong>Dica:</strong> Clique em qualquer documento para ver a descrição completa e fazer o download.
        </p>
      </div>
    </div>
  );
}
