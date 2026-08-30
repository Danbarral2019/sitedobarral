'use client';

import type { CuratedCrossRef, LeiArticle } from '@/hooks/use-lei14133-preview';

interface LeiCuratedCrossRefsProps {
  refs: CuratedCrossRef[];
  allArticles: LeiArticle[];
  onSelectArticle: (article: LeiArticle) => void;
}

export function LeiCuratedCrossRefs({ refs, allArticles, onSelectArticle }: LeiCuratedCrossRefsProps) {
  if (refs.length === 0) return null;

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-md p-5">
      <h3 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2">
        Leitura combinada
      </h3>
      <p className="text-xs text-brand-700 mb-3 italic">Vínculos curados entre artigos da Lei 14.133.</p>
      <ul className="space-y-2">
        {refs.map((ref) => {
          const target = allArticles.find((a) => a.numero === ref.targetNumber);
          return (
            <li key={ref.id} className="flex items-start gap-3">
              <button
                onClick={() => target && onSelectArticle(target)}
                disabled={!target}
                className="flex-shrink-0 px-2.5 py-1 bg-brand-600 text-surface-page text-xs font-bold rounded hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Art. {ref.targetNumber}
              </button>
              <p className="text-sm text-ink-primary">{ref.note}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
