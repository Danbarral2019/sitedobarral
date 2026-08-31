import Link from 'next/link';
import { Scale } from 'lucide-react';
import type { LeiArticleResult } from '@/lib/types/global-search';
import { highlightText } from './search-utils';

export interface LeiArticleResultCardProps {
  article: LeiArticleResult;
  query: string;
  onClick?: () => void;
}

export function LeiArticleResultCard({
  article,
  query,
  onClick,
}: LeiArticleResultCardProps) {
  return (
    <Link
      href={`/area-restrita/artigo/${article.numero}`}
      onClick={onClick}
      className="block bg-white rounded-[6px] border border-border-subtle p-4 hover:border-brand-300 hover: transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-[6px] bg-brand-50 text-brand-600 flex-shrink-0">
          <Scale className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-ink-primary text-sm group-hover:text-brand-600 transition-colors">
            Artigo {article.numero}
          </h4>
          <p className="text-sm text-ink-muted mt-1 line-clamp-3">
            {highlightText(article.ementa.slice(0, 200) + '...', query)}
          </p>
          {article.excerpts && article.excerpts.length > 0 && (
            <div className="mt-2 text-xs text-brand-600 bg-brand-50 px-2 py-1 rounded">
              {article.excerpts.length} trecho(s) relevante(s)
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-[3px] text-xs font-medium bg-surface-deep text-ink-muted">
              {article.capitulo}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
