'use client';

import { X } from 'lucide-react';
import { getTypeLabel, getEsferaLabel } from '@/lib/legislacao/labels';
import { getThemeLabel } from '@/data/temas-licitacoes';

interface LegislacaoActiveChipsProps {
  esferaFilter: string;
  onEsferaClear: () => void;
  typeFilter: string;
  onTypeClear: () => void;
  issuerFilter: string;
  onIssuerClear: () => void;
  yearFilter: string;
  onYearClear: () => void;
  themeFilter: string;
  onThemeClear: () => void;
  searchTerm: string;
  onSearchClear: () => void;
  onClearAll: () => void;
}

export function LegislacaoActiveChips({
  esferaFilter,
  onEsferaClear,
  typeFilter,
  onTypeClear,
  issuerFilter,
  onIssuerClear,
  yearFilter,
  onYearClear,
  themeFilter,
  onThemeClear,
  searchTerm,
  onSearchClear,
  onClearAll,
}: LegislacaoActiveChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <span className="text-sm font-semibold text-ink-muted">Filtros:</span>
      {esferaFilter && (
        <Chip label={getEsferaLabel(esferaFilter)} onClear={onEsferaClear} />
      )}
      {typeFilter && <Chip label={getTypeLabel(typeFilter)} onClear={onTypeClear} />}
      {issuerFilter && <Chip label={issuerFilter} onClear={onIssuerClear} />}
      {yearFilter && <Chip label={yearFilter} onClear={onYearClear} />}
      {themeFilter && <Chip label={getThemeLabel(themeFilter)} onClear={onThemeClear} />}
      {searchTerm && <Chip label={`"${searchTerm}"`} onClear={onSearchClear} />}
      <button onClick={onClearAll} className="text-sm text-ink-muted hover:text-ink-primary underline ml-2">
        Limpar todos
      </button>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm border bg-surface-raised text-ink-secondary border-border-subtle">
      {label}
      <button onClick={onClear} aria-label={`Remover filtro ${label}`}>
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
