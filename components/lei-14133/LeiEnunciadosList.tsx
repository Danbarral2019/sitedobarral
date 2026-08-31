'use client';

import { MessageSquareQuote, ExternalLink } from 'lucide-react';
import type { EnunciadoResumo } from '@/hooks/use-lei14133-preview';

interface LeiEnunciadosListProps {
  enunciados: EnunciadoResumo[];
}

export function LeiEnunciadosList({ enunciados }: LeiEnunciadosListProps) {
  if (enunciados.length === 0) return null;

  return (
    <div className="bg-surface-page rounded-md border border-border-subtle p-6">
      <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2">
        <MessageSquareQuote className="w-5 h-5 text-ink-secondary" />
        Enunciados Interpretativos ({enunciados.length})
      </h3>
      <div className="space-y-3">
        {enunciados.map((e) => {
          const cardContent = (
            <>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-2 py-1 bg-brand-600 text-surface-page text-xs font-bold rounded">
                  {e.orgao} {e.numero}
                </span>
                <span className="text-xs text-ink-secondary bg-surface-deep px-2 py-0.5 rounded">{e.tema}</span>
                {e.url && (
                  <ExternalLink className="w-3.5 h-3.5 text-ink-secondary ml-auto" aria-hidden="true" />
                )}
              </div>
              <p className="text-ink-primary text-sm leading-relaxed">{e.texto}</p>
            </>
          );
          return e.url ? (
            <a
              key={e.id}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-l-4 border-brand-600 bg-surface-raised p-4 rounded-r-lg hover:bg-surface-deep transition-colors"
            >
              {cardContent}
            </a>
          ) : (
            <div key={e.id} className="border-l-4 border-brand-600 bg-surface-raised p-4 rounded-r-lg">
              {cardContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
