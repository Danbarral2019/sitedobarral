'use client';

import { Hash, BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import {
  LEI_14133_ARTIGOS,
  formatArticleNumber,
  formatArticleTitle
} from '@/data/lei-14133-artigos';

interface LeiArticleBadgeProps {
  articleNumber: string;
  variant?: 'default' | 'compact' | 'detailed';
  showLink?: boolean; // Se true, torna o badge clicável
  className?: string;
}

export default function LeiArticleBadge({
  articleNumber,
  variant = 'default',
  showLink = false,
  className = '',
}: LeiArticleBadgeProps) {
  const article = LEI_14133_ARTIGOS[articleNumber];

  // Se o artigo não existe, não renderiza nada
  if (!article) {
    return null;
  }

  const badgeContent = () => {
    switch (variant) {
      case 'compact':
        return (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-900 rounded-md text-xs font-medium ${className}`}>
            <Hash className="w-3 h-3" />
            <span>{formatArticleNumber(articleNumber)}</span>
          </div>
        );

      case 'detailed':
        return (
          <div className={`inline-flex items-start gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg ${className}`}>
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {articleNumber}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 text-sm mb-1">
                {formatArticleNumber(articleNumber)}
              </div>
              <div className="text-xs text-gray-700 line-clamp-2">
                {article.ementa}
              </div>
              {article.secao && (
                <div className="text-xs text-gray-500 mt-1">
                  {article.secao}
                </div>
              )}
            </div>
            {showLink && (
              <ExternalLink className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
            )}
          </div>
        );

      default: // 'default'
        return (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-900 rounded-lg hover:bg-blue-200 transition-colors ${className}`}>
            <Hash className="w-4 h-4" />
            <span className="font-medium text-sm">
              {formatArticleNumber(articleNumber)}
            </span>
            <span className="text-xs text-blue-700 max-w-[200px] truncate">
              {article.ementa}
            </span>
            {showLink && (
              <ExternalLink className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            )}
          </div>
        );
    }
  };

  // Se showLink é true, envolve em Link
  if (showLink) {
    return (
      <Link
        href={`/artigo/${articleNumber}`}
        className="inline-block hover:opacity-90 transition-opacity"
        title={formatArticleTitle(article)}
      >
        {badgeContent()}
      </Link>
    );
  }

  return badgeContent();
}

// Componente para exibir múltiplos badges
interface LeiArticleBadgesProps {
  articleNumbers: string[]; // Array de números de artigos
  variant?: 'default' | 'compact' | 'detailed';
  showLink?: boolean;
  maxDisplay?: number; // Máximo de badges para exibir (restante vai para "+X")
  className?: string;
}

export function LeiArticleBadges({
  articleNumbers,
  variant = 'default',
  showLink = false,
  maxDisplay,
  className = '',
}: LeiArticleBadgesProps) {
  if (!articleNumbers || articleNumbers.length === 0) {
    return null;
  }

  const displayedArticles = maxDisplay
    ? articleNumbers.slice(0, maxDisplay)
    : articleNumbers;
  const remainingCount = maxDisplay
    ? Math.max(0, articleNumbers.length - maxDisplay)
    : 0;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {displayedArticles.map((articleNumber) => (
        <LeiArticleBadge
          key={articleNumber}
          articleNumber={articleNumber}
          variant={variant}
          showLink={showLink}
        />
      ))}
      {remainingCount > 0 && (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
          <span>+{remainingCount} {remainingCount === 1 ? 'artigo' : 'artigos'}</span>
        </div>
      )}
    </div>
  );
}

// Componente para a seção de artigos relacionados
interface RelatedArticlesSectionProps {
  articleNumbers: string[];
  title?: string;
  showAllLink?: boolean; // Mostrar link "Ver todos os artigos"
  className?: string;
}

export function RelatedArticlesSection({
  articleNumbers,
  title = "📚 Artigos da Lei 14.133/2021",
  showAllLink = true,
  className = '',
}: RelatedArticlesSectionProps) {
  if (!articleNumbers || articleNumbers.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {showAllLink && (
          <Link
            href="/artigos"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Ver todos os artigos
          </Link>
        )}
      </div>
      <LeiArticleBadges
        articleNumbers={articleNumbers}
        variant="default"
        showLink={true}
      />
    </div>
  );
}
