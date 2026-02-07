'use client';

import Link from 'next/link';
import { Eye, ChevronDown, ChevronUp, BookOpen, Scale } from 'lucide-react';
import { ArticleBadges } from '../ArticleBadges';
import ReactMarkdown from 'react-markdown';

interface GlossaryTermCardProps {
  term: {
    id: string;
    term: string;
    slug: string;
    definition: string;
    shortDef?: string | null;
    category?: string | null;
    viewCount: number;
    leiArticles?: string | null;
    relatedTerms?: string | null;
  };
  isExpanded: boolean;
  onToggle: () => void;
}

export function GlossaryTermCard({ term, isExpanded, onToggle }: GlossaryTermCardProps) {
  // Parse relatedTerms (JSON array de slugs)
  const parseRelatedTerms = (): string[] => {
    if (!term.relatedTerms) return [];
    try {
      const parsed = JSON.parse(term.relatedTerms);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const relatedTerms = parseRelatedTerms();

  // Melhorar formatação do texto automaticamente
  const formatDefinition = (text: string): string => {
    let formatted = text;

    // Detectar listas numeradas e adicionar quebras de linha
    formatted = formatted.replace(/(\d+)\.\s+/g, '\n\n$1. ');

    // Detectar listas com letras e adicionar quebras de linha
    formatted = formatted.replace(/([a-z])\)\s+/g, '\n\n$1) ');

    // Detectar listas com marcadores e adicionar quebras de linha
    formatted = formatted.replace(/[-•]\s+/g, '\n\n- ');

    // Remover múltiplas quebras de linha consecutivas
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    return formatted.trim();
  };

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      {/* Header - Sempre visível */}
      <button
        onClick={onToggle}
        className="w-full p-5 hover:bg-blue-50 transition-colors duration-150 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 mb-1">
              <h3 className="text-lg font-bold text-gray-900">
                {term.term}
              </h3>
              {term.category && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                  {term.category}
                </span>
              )}
            </div>

            {term.shortDef && !isExpanded && (
              <p className="text-gray-600 text-sm line-clamp-1">
                {term.shortDef}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{term.viewCount}</span>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-blue-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {/* Conteúdo Expandido */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-6">
          {/* Definição com formatação melhorada */}
          <div className="prose prose-sm max-w-none">
            <div className="text-gray-700 leading-relaxed text-justify">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-4 text-justify">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="ml-4">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                }}
              >
                {formatDefinition(term.definition)}
              </ReactMarkdown>
            </div>
          </div>

          {/* Artigos da Lei Indexados */}
          {term.leiArticles && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-bold text-gray-900">
                  Artigos da Lei 14.133/2021 Relacionados
                </h4>
              </div>
              <ArticleBadges
                leiArticles={term.leiArticles}
                maxVisible={10}
                onArticleClick={(articleNum) => {
                  // Navega para a página do artigo
                  window.location.href = `/artigo/${articleNum}`;
                }}
              />
            </div>
          )}

          {/* Termos Correlatos */}
          {relatedTerms.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-bold text-gray-900">
                  Termos Correlatos
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {relatedTerms.map((slug) => (
                  <Link
                    key={slug}
                    href={`/glossario?termo=${slug}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Recarregar a página com o termo selecionado
                      window.location.href = `/glossario?termo=${slug}`;
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors"
                  >
                    {slug.split('-').map(word =>
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
