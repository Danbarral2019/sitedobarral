'use client';

import {
  extractArticleNumbers,
  formatArticleNumber,
  getArticleBadgeClasses,
} from '@/lib/article-utils';
import { useLeiArticles } from '@/hooks/useLeiArticles';

interface ArticleBadgesProps {
  leiArticles: string | null;
  maxVisible?: number;
  primaryArticle?: string; // Artigo principal (mais destacado)
  onArticleClick?: (articleNumber: string) => void;
}

export function ArticleBadges({
  leiArticles,
  maxVisible = 5,
  primaryArticle,
  onArticleClick
}: ArticleBadgesProps) {
  const { getArticle } = useLeiArticles();
  const articles = extractArticleNumbers(leiArticles);

  if (articles.length === 0) return null;

  // Ordena: artigo principal primeiro, depois ordem numérica
  const sortedArticles = [...articles].sort((a, b) => {
    if (a === primaryArticle) return -1;
    if (b === primaryArticle) return 1;
    return parseInt(a) - parseInt(b);
  });

  const visibleArticles = sortedArticles.slice(0, maxVisible);
  const hiddenCount = sortedArticles.length - maxVisible;

  const handleClick = (articleNum: string) => {
    if (onArticleClick) {
      onArticleClick(articleNum);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visibleArticles.map((articleNum) => {
        const isPrimary = articleNum === primaryArticle;
        const article = getArticle(articleNum);
        const classes = getArticleBadgeClasses(articleNum, isPrimary);

        return (
          <button
            key={articleNum}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClick(articleNum);
            }}
            className={`${classes} group relative`}
            title={article ? article.ementa : undefined}
          >
            {formatArticleNumber(articleNum)}
            {isPrimary && (
              <span className="ml-1 text-[10px] opacity-80">★</span>
            )}

            {/* Tooltip com ementa completa ao hover */}
            {article && (
              <span className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap max-w-xs z-10 shadow-lg">
                <span className="font-semibold">{formatArticleNumber(articleNum)}</span>
                <br />
                <span className="text-gray-300 text-[11px] line-clamp-2">{article.ementa}</span>
                <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></span>
              </span>
            )}
          </button>
        );
      })}

      {hiddenCount > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
