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
      className="block bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0">
          <Scale className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[var(--text-primary)] text-sm group-hover:text-indigo-600 transition-colors">
            Artigo {article.numero}
          </h4>
          <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-3">
            {highlightText(article.ementa.slice(0, 200) + '...', query)}
          </p>
          {article.excerpts && article.excerpts.length > 0 && (
            <div className="mt-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              {article.excerpts.length} trecho(s) relevante(s)
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
              {article.capitulo}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
