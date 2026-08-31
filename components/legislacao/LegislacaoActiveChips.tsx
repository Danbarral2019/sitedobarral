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
        <Chip label={getEsferaLabel(esferaFilter)} color="blue" onClear={onEsferaClear} />
      )}
      {typeFilter && <Chip label={getTypeLabel(typeFilter)} color="purple" onClear={onTypeClear} />}
      {issuerFilter && <Chip label={issuerFilter} color="green" onClear={onIssuerClear} />}
      {yearFilter && <Chip label={yearFilter} color="orange" onClear={onYearClear} />}
      {themeFilter && <Chip label={getThemeLabel(themeFilter)} color="indigo" onClear={onThemeClear} />}
      {searchTerm && <Chip label={`"${searchTerm}"`} color="gray" onClear={onSearchClear} />}
      <button onClick={onClearAll} className="text-sm text-ink-muted hover:text-red-600 underline ml-2">
        Limpar todos
      </button>
    </div>
  );
}

const CHIP_COLORS: Record<string, string> = {
  blue: 'bg-brand-50 text-brand-700 border-brand-200',
  purple: 'bg-brand-50 text-brand-700 border-brand-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  orange: 'bg-amber-accent-soft text-amber-accent-deep border-amber-accent-soft',
  indigo: 'bg-brand-50 text-brand-700 border-brand-200',
  gray: 'bg-surface-deep text-ink-secondary border-border-subtle',
};

function Chip({ label, color, onClear }: { label: string; color: string; onClear: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border ${CHIP_COLORS[color]}`}>
      {label}
      <button onClick={onClear} aria-label={`Remover filtro ${label}`}>
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
