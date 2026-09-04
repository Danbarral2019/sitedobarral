'use client';

import { Eye, ChevronDown, ChevronUp, BookOpen, Scale } from 'lucide-react';
import dynamic from 'next/dynamic';

const ArticleBadges = dynamic(
  () => import('../ArticleBadges').then((module) => module.ArticleBadges),
  { ssr: false },
);
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

interface ResolvedRelatedTerm {
  id: string;
  term: string;
  slug: string;
}

interface GlossaryTermCardProps {
  term: {
    id: string;
    term: string;
    slug: string;
    definition: string;
    shortDef?: string | null;
    category?: string | null;
    viewCount: number;
    leiArticles?: string | string[] | null;
    leiArticlesArr?: string[];
    relatedTerms?: string | null;
    resolvedRelatedTerms?: ResolvedRelatedTerm[];
  };
  isExpanded: boolean;
  onToggle: () => void;
  onTermClick?: (slug: string) => void;
  articleBasePath?: string; // '/artigo' (público) ou '/area-restrita/artigo' (logado)
}

export function GlossaryTermCard({ term, isExpanded, onToggle, onTermClick, articleBasePath = '/artigo' }: GlossaryTermCardProps) {
  // Use resolved related terms from API if available, fallback to raw parse
  const relatedTerms: ResolvedRelatedTerm[] = term.resolvedRelatedTerms || [];

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
    <div className="border-b border-border-subtle last:border-b-0">
      {/* Header - Sempre visível */}
      <button
        onClick={onToggle}
        className="w-full p-5 hover:bg-brand-50 transition-colors duration-150 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 mb-1">
              <h3 className="text-lg font-bold text-ink-primary">
                {term.term}
              </h3>
              {term.category && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-[3px] text-xs font-medium bg-brand-100 text-brand-800 flex-shrink-0">
                  {term.category}
                </span>
              )}
            </div>

            {term.shortDef && !isExpanded && (
              <p className="text-ink-muted text-sm line-clamp-1">
                {term.shortDef}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-ink-muted flex-shrink-0">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{term.viewCount}</span>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-brand-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-ink-muted" />
            )}
          </div>
        </div>
      </button>

      {/* Conteúdo Expandido */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-6">
          {/* Definição com formatação melhorada */}
          <div className="max-w-none">
            <div className="text-ink-secondary leading-relaxed text-justify">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-4 text-justify">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="ml-4">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-ink-primary">{children}</strong>,
                }}
              >
                {formatDefinition(term.definition)}
              </ReactMarkdown>
            </div>
          </div>

          {/* Artigos da Lei Indexados */}
          {(term.leiArticlesArr?.length || term.leiArticles) && (
            <div className="pt-4 border-t border-border-subtle">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="w-4 h-4 text-brand-600" />
                <h4 className="text-sm font-bold text-ink-primary">
                  Artigos da Lei 14.133/2021 Relacionados
                </h4>
              </div>
              <ArticleBadges
                leiArticles={term.leiArticlesArr || term.leiArticles || null}
                maxVisible={10}
                onArticleClick={(articleNum) => {
                  window.location.href = `${articleBasePath}/${articleNum}`;
                }}
              />
            </div>
          )}

          {/* Termos Correlatos */}
          {relatedTerms.length > 0 && (
            <div className="pt-4 border-t border-border-subtle">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand-600" />
                <h4 className="text-sm font-bold text-ink-primary">
                  Termos Correlatos
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {relatedTerms.map((related) => (
                  <button
                    key={related.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onTermClick) {
                        onTermClick(related.slug);
                      } else {
                        window.location.href = `/glossario/${related.slug}`;
                      }
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-[3px] text-sm font-medium bg-brand-100 text-brand-800 hover:bg-brand-200 transition-colors cursor-pointer"
                  >
                    {related.term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
