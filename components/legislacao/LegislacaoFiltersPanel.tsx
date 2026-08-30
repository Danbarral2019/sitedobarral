'use client';

import { X } from 'lucide-react';
import { TEMAS_LICITACOES } from '@/data/temas-licitacoes';
import { getTypeLabel, getEsferaLabel } from '@/lib/legislacao/labels';
import type { LegislacaoTheme } from '@/lib/legislacao/theme';

interface LegislacaoFiltersPanelProps {
  theme: LegislacaoTheme;
  showTypeFilter: boolean;
  showIssuerAsText: boolean;
  availableTypes: Array<{ type: string; count: number }>;
  availableIssuers: Array<{ issuer: string; count: number }>;
  availableYears: Array<{ year: number; count: number }>;
  availableEsferas: Array<{ esfera: string; count: number }>;
  typeFilter: string;
  onTypeChange: (v: string) => void;
  issuerFilter: string;
  onIssuerChange: (v: string) => void;
  esferaFilter: string;
  onEsferaChange: (v: string) => void;
  yearFilter: string;
  onYearChange: (v: string) => void;
  themeFilter: string;
  onThemeChange: (v: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

export function LegislacaoFiltersPanel({
  theme,
  showTypeFilter,
  showIssuerAsText,
  availableTypes,
  availableIssuers,
  availableYears,
  availableEsferas,
  typeFilter,
  onTypeChange,
  issuerFilter,
  onIssuerChange,
  esferaFilter,
  onEsferaChange,
  yearFilter,
  onYearChange,
  themeFilter,
  onThemeChange,
  hasActiveFilters,
  onClear,
}: LegislacaoFiltersPanelProps) {
  return (
    <div className="bg-surface-page border-2 border-border-subtle rounded-md p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {showTypeFilter && (
          <div>
            <label className="block text-sm font-bold text-ink-secondary mb-2">Tipo de Ato</label>
            <select
              value={typeFilter}
              onChange={(e) => onTypeChange(e.target.value)}
              className="w-full px-4 py-2 border-2 border-border-strong rounded-[3px] focus:ring-2 focus:ring-amber-accent"
            >
              <option value="">Todos</option>
              {availableTypes.map(({ type, count }) => (
                <option key={type} value={type}>
                  {getTypeLabel(type)} ({count})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-ink-secondary mb-2">
            {showIssuerAsText ? 'Órgão de Origem' : 'Órgão Emissor'}
          </label>
          {showIssuerAsText ? (
            <input
              type="text"
              value={issuerFilter}
              onChange={(e) => onIssuerChange(e.target.value)}
              placeholder="Ex: TCE-SP, CGE-MG..."
              className="w-full px-4 py-2 border-2 border-border-strong rounded-[3px] focus:ring-2 focus:ring-amber-accent"
              list="issuers-list"
            />
          ) : (
            <select
              value={issuerFilter}
              onChange={(e) => onIssuerChange(e.target.value)}
              className="w-full px-4 py-2 border-2 border-border-strong rounded-[3px] focus:ring-2 focus:ring-amber-accent"
            >
              <option value="">Todos</option>
              {availableIssuers.map(({ issuer, count }) => (
                <option key={issuer} value={issuer}>
                  {issuer} ({count})
                </option>
              ))}
            </select>
          )}
          {showIssuerAsText && availableIssuers.length > 0 && (
            <datalist id="issuers-list">
              {availableIssuers.map(({ issuer }) => (
                <option key={issuer} value={issuer} />
              ))}
            </datalist>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-ink-secondary mb-2">Esfera</label>
          <select
            value={esferaFilter}
            onChange={(e) => onEsferaChange(e.target.value)}
            className="w-full px-4 py-2 border-2 border-border-strong rounded-[3px] focus:ring-2 focus:ring-amber-accent"
          >
            <option value="">Todas</option>
            {availableEsferas.map(({ esfera, count }) => (
              <option key={esfera} value={esfera}>
                {getEsferaLabel(esfera)} ({count})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-ink-secondary mb-2">Ano</label>
          <select
            value={yearFilter}
            onChange={(e) => onYearChange(e.target.value)}
            className="w-full px-4 py-2 border-2 border-border-strong rounded-[3px] focus:ring-2 focus:ring-amber-accent"
          >
            <option value="">Todos</option>
            {availableYears.map(({ year, count }) => (
              <option key={year} value={String(year)}>
                {year} ({count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-ink-secondary mb-2">Temas</label>
        <div className="flex flex-wrap gap-2">
          {TEMAS_LICITACOES.map((tema) => (
            <button
              key={tema.value}
              onClick={() => onThemeChange(themeFilter === tema.value ? '' : tema.value)}
              className={`px-3 py-1.5 text-xs rounded-full border-2 transition-colors font-medium ${
                themeFilter === tema.value
                  ? `${theme.primaryActionBg} text-white border-transparent`
                  : 'bg-surface-page text-ink-secondary border-border-strong hover:border-border-strong'
              }`}
            >
              {tema.label}
            </button>
          ))}
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-2 px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary hover:bg-surface-deep rounded-[3px] transition-colors"
        >
          <X className="w-4 h-4" />
          Limpar todos os filtros
        </button>
      )}
    </div>
  );
}
