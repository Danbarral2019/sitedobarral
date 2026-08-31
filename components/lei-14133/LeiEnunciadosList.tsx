'use client';

import { MessageSquareQuote, ExternalLink } from 'lucide-react';
import type { EnunciadoResumo } from '@/hooks/use-lei14133-preview';

interface LeiEnunciadosListProps {
  enunciados: EnunciadoResumo[];
}

export function LeiEnunciadosList({ enunciados }: LeiEnunciadosListProps) {
  if (enunciados.length === 0) return null;

  return (
    <div className="bg-white rounded-[6px] p-6 border border-border-subtle">
      <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2">
        <MessageSquareQuote className="w-5 h-5 text-brand-600" />
        Enunciados Interpretativos ({enunciados.length})
      </h3>
      <div className="space-y-3">
        {enunciados.map((e) => {
          const cardContent = (
            <>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-2 py-1 bg-brand-600 text-white text-xs font-bold rounded">
                  {e.orgao} {e.numero}
                </span>
                <span className="text-xs text-brand-700 bg-brand-100 px-2 py-0.5 rounded">{e.tema}</span>
                {e.url && (
                  <ExternalLink className="w-3.5 h-3.5 text-brand-600 ml-auto" aria-hidden="true" />
                )}
              </div>
              <p className="text-ink-secondary text-sm leading-relaxed">{e.texto}</p>
            </>
          );
          return e.url ? (
            <a
              key={e.id}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-l-4 border-brand-500 bg-brand-50 p-4 rounded-r-[6px] hover:bg-brand-100 transition-colors"
            >
              {cardContent}
            </a>
          ) : (
            <div key={e.id} className="border-l-4 border-brand-500 bg-brand-50 p-4 rounded-r-[6px]">
              {cardContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
