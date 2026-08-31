'use client';

import { Star, ExternalLink } from 'lucide-react';
import type { EnrichedDoc } from '@/hooks/use-lei14133-preview';

const HIERARCHY_LABELS: Record<number, string> = {
  1: 'Lei',
  2: 'Decreto',
  3: 'Portaria',
  4: 'IN',
  5: 'OS',
};

function getTierLabel(doc: EnrichedDoc): string {
  if (doc.type === 'legislativeAct' && doc.hierarchyLevel) {
    return HIERARCHY_LABELS[doc.hierarchyLevel] || doc.category || 'Documento';
  }
  return doc.category || 'Documento';
}

function getAccentClass(category: string | null): string {
  if (category === 'lei' || category === 'medida-provisoria') return 'border-brand-300 bg-brand-50/40';
  if (category === 'decreto') return 'border-brand-300 bg-brand-50/40';
  return 'border-amber-accent bg-amber-accent-soft/40';
}

function getDocHref(doc: EnrichedDoc): string {
  if (doc.url) return doc.url;
  return doc.type === 'legislativeAct' ? `/atos-normativos/${doc.id}` : `/api/documents/${doc.id}/download`;
}

export function HighlightCard({ doc }: { doc: EnrichedDoc }) {
  const tierLabel = getTierLabel(doc);
  const accent = getAccentClass(doc.category);

  return (
    <a
      href={getDocHref(doc)}
      target={doc.url ? '_blank' : undefined}
      rel={doc.url ? 'noopener noreferrer' : undefined}
      className={`block border-2 ${accent} rounded-[6px] p-4 hover: transition-all group`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-white rounded-[6px] flex items-center justify-center border border-border-subtle">
          <Star className="w-5 h-5 text-amber-accent-deep fill-amber-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2 py-0.5 bg-white border border-border-subtle text-ink-secondary text-[11px] font-bold uppercase rounded tracking-wide">
              {tierLabel}
            </span>
            {doc.notesImportance === 'critica' && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[11px] font-bold uppercase rounded">Crítico</span>
            )}
            {doc.notesImportance === 'alta' && (
              <span className="px-2 py-0.5 bg-amber-accent-soft text-ink-primary text-[11px] font-bold uppercase rounded">Destaque</span>
            )}
            {doc.esfera === 'federal' && doc.type === 'legislativeAct' && (
              <span className="px-2 py-0.5 bg-brand-50 text-brand-700 text-[11px] font-medium rounded">Federal</span>
            )}
          </div>
          <h4 className="font-semibold text-ink-primary text-base leading-snug mb-1 group-hover:text-brand-700 transition-colors">
            {doc.title}
          </h4>
          {doc.summary && (
            <p className="text-sm text-ink-muted leading-relaxed line-clamp-2 mb-2">{doc.summary}</p>
          )}
          <p className="text-xs text-ink-muted italic">{doc.highlightReason}</p>
        </div>
        <ExternalLink className="w-4 h-4 text-ink-muted flex-shrink-0 mt-1 group-hover:text-brand-600 transition-colors" />
      </div>
    </a>
  );
}

export { getDocHref };
