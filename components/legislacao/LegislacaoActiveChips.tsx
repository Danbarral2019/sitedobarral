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
      <span className="text-sm font-semibold text-gray-600">Filtros:</span>
      {esferaFilter && (
        <Chip label={getEsferaLabel(esferaFilter)} color="blue" onClear={onEsferaClear} />
      )}
      {typeFilter && <Chip label={getTypeLabel(typeFilter)} color="purple" onClear={onTypeClear} />}
      {issuerFilter && <Chip label={issuerFilter} color="green" onClear={onIssuerClear} />}
      {yearFilter && <Chip label={yearFilter} color="orange" onClear={onYearClear} />}
      {themeFilter && <Chip label={getThemeLabel(themeFilter)} color="indigo" onClear={onThemeClear} />}
      {searchTerm && <Chip label={`"${searchTerm}"`} color="gray" onClear={onSearchClear} />}
      <button onClick={onClearAll} className="text-sm text-gray-500 hover:text-red-600 underline ml-2">
        Limpar todos
      </button>
    </div>
  );
}

const CHIP_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
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
