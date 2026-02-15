'use client';

import { Search, X, Filter } from 'lucide-react';
import { TEMAS_LICITACOES, getThemeLabel } from '@/data/temas-licitacoes';
import { TYPE_LABELS, ESFERA_LABELS } from './constants';

interface ActsFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  selectedType: string;
  setSelectedType: (v: string) => void;
  issuerFilter: string;
  setIssuerFilter: (v: string) => void;
  yearFilter: string;
  setYearFilter: (v: string) => void;
  esferaFilter: string;
  setEsferaFilter: (v: string) => void;
  themeFilter: string;
  setThemeFilter: (v: string) => void;
  isBoasPraticas: boolean;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  hasActiveFilters: string | boolean;
  clearFilters: () => void;
  availableTypes: Array<{ type: string; count: number }>;
  availableIssuers: Array<{ issuer: string; count: number }>;
  availableYears: Array<{ year: number; count: number }>;
  availableEsferas: Array<{ esfera: string; count: number }>;
  setPage: (v: number) => void;
}

export default function ActsFilters({
  search,
  setSearch,
  selectedType,
  setSelectedType,
  issuerFilter,
  setIssuerFilter,
  yearFilter,
  setYearFilter,
  esferaFilter,
  setEsferaFilter,
  themeFilter,
  setThemeFilter,
  isBoasPraticas,
  showFilters,
  setShowFilters,
  hasActiveFilters,
  clearFilters,
  availableTypes,
  availableIssuers,
  availableYears,
  availableEsferas,
  setPage,
}: ActsFiltersProps) {
  return (
    <>
      {/* Busca */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={isBoasPraticas
              ? 'Buscar por título ou descrição...'
              : 'Buscar por título, número ou ementa...'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-10 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 transition-colors"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-2 rounded-xl text-sm font-medium transition-colors ${
            showFilters || hasActiveFilters
              ? isBoasPraticas
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-amber-400 bg-amber-50 text-amber-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {hasActiveFilters && (
            <span className={`w-2 h-2 rounded-full ${isBoasPraticas ? 'bg-emerald-600' : 'bg-amber-600'}`} />
          )}
        </button>
      </div>

      {/* Painel de Filtros Expandido */}
      {showFilters && (
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-3 space-y-3">
          {/* Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Tipo (apenas atos) */}
            {!isBoasPraticas && (
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Tipo</label>
                <select
                  value={selectedType}
                  onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
                >
                  <option value="">Todos</option>
                  {availableTypes.map(({ type, count }) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type] || type} ({count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Orgao */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                {isBoasPraticas ? 'Órgão de Origem' : 'Órgão Emissor'}
              </label>
              {isBoasPraticas ? (
                <input
                  type="text"
                  value={issuerFilter}
                  onChange={(e) => { setIssuerFilter(e.target.value); setPage(1); }}
                  placeholder="Ex: TCE-SP..."
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                  list="panel-issuers-list"
                />
              ) : (
                <select
                  value={issuerFilter}
                  onChange={(e) => { setIssuerFilter(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
                >
                  <option value="">Todos</option>
                  {availableIssuers.map(({ issuer, count }) => (
                    <option key={issuer} value={issuer}>
                      {issuer} ({count})
                    </option>
                  ))}
                </select>
              )}
              {isBoasPraticas && availableIssuers.length > 0 && (
                <datalist id="panel-issuers-list">
                  {availableIssuers.map(({ issuer }) => (
                    <option key={issuer} value={issuer} />
                  ))}
                </datalist>
              )}
            </div>

            {/* Esfera */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Esfera</label>
              <select
                value={esferaFilter}
                onChange={(e) => { setEsferaFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
              >
                <option value="">Todas</option>
                {availableEsferas.map(({ esfera, count }) => (
                  <option key={esfera} value={esfera}>
                    {ESFERA_LABELS[esfera] || esfera} ({count})
                  </option>
                ))}
              </select>
            </div>

            {/* Ano */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Ano</label>
              <select
                value={yearFilter}
                onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
              >
                <option value="">Todos</option>
                {availableYears.map(({ year, count }) => (
                  <option key={year} value={year}>
                    {year} ({count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Temas como chips */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">Temas</label>
            <div className="flex flex-wrap gap-1.5">
              {TEMAS_LICITACOES.map((tema) => (
                <button
                  key={tema.value}
                  onClick={() => {
                    setThemeFilter(themeFilter === tema.value ? '' : tema.value);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors font-medium ${
                    themeFilter === tema.value
                      ? isBoasPraticas
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {tema.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chips de filtros ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-xs font-semibold text-gray-500">Filtros:</span>
          {esferaFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
              {ESFERA_LABELS[esferaFilter] || esferaFilter}
              <button onClick={() => { setEsferaFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          {selectedType && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs border border-purple-200">
              {TYPE_LABELS[selectedType] || selectedType}
              <button onClick={() => { setSelectedType(''); setPage(1); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          {issuerFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs border border-green-200">
              {issuerFilter}
              <button onClick={() => { setIssuerFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          {yearFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs border border-orange-200">
              {yearFilter}
              <button onClick={() => { setYearFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          {themeFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs border border-indigo-200">
              {getThemeLabel(themeFilter)}
              <button onClick={() => { setThemeFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs border border-gray-200">
              &quot;{search}&quot;
              <button onClick={() => { setSearch(''); setPage(1); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-red-600 underline ml-1"
          >
            Limpar
          </button>
        </div>
      )}
    </>
  );
}
