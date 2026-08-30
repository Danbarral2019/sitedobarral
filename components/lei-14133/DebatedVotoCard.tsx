'use client';

import { Scale, ExternalLink } from 'lucide-react';
import type { EnrichedDoc } from '@/hooks/use-lei14133-preview';
import { getDocHref } from './HighlightCard';

/**
 * Card do tier "debatido no voto" — o acórdão em que o artigo foi RAZÃO DE
 * DECIDIR (aplicado no voto do TCU), não citação de passagem. É o sinal mais
 * forte da jurisprudência; ganha destaque próprio, acima dos demais.
 */
export function DebatedVotoCard({ doc }: { doc: EnrichedDoc }) {
  return (
    <a
      href={getDocHref(doc)}
      target={doc.url ? '_blank' : undefined}
      rel={doc.url ? 'noopener noreferrer' : undefined}
      className="block border-2 border-border-strong bg-surface-raised/40 rounded-xl p-4 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-surface-page rounded-[3px] flex items-center justify-center border border-border-subtle">
          <Scale className="w-5 h-5 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2 py-0.5 bg-surface-deep text-brand-700 text-[11px] font-bold uppercase rounded tracking-wide">
              Debatido no voto
            </span>
            {doc.isPublic && (
              <span className="px-2 py-0.5 bg-surface-raised text-ink-secondary text-[10px] font-medium rounded">Público</span>
            )}
          </div>
          <h4 className="font-semibold text-ink-primary text-base leading-snug mb-1 group-hover:text-brand-700 transition-colors">
            {doc.title}
          </h4>
          {doc.summary && (
            <p className="text-sm text-ink-secondary leading-relaxed line-clamp-2 mb-2">{doc.summary}</p>
          )}
          <p className="text-xs text-brand-700/80 italic">Razão de decidir — o artigo foi aplicado no voto.</p>
        </div>
        <ExternalLink className="w-4 h-4 text-ink-muted flex-shrink-0 mt-1 group-hover:text-brand-600 transition-colors" />
      </div>
    </a>
  );
}
