'use client';

import {
  Gavel, FileText, Loader2,
  Scale, Monitor,
} from 'lucide-react';
import { useLegislativeActs } from '@/hooks/use-legislative-acts';
import ActCard from './ActCard';
import ActsFilters from './ActsFilters';

export default function LegislativeActsPanel() {
  const {
    acts,
    isLoading,
    activeTab,
    tabCounts,
    isTic,
    availableTypes,
    availableIssuers,
    availableYears,
    availableEsferas,
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
    page,
    setPage,
    total,
    totalPages,
    showFilters,
    setShowFilters,
    expandedAct,
    setExpandedAct,
    isBoasPraticas,
    hasActiveFilters,
    clearFilters,
    switchTab,
    formatDate,
  } = useLegislativeActs();

  return (
    <div className="bg-white rounded-[6px] border-2 border-border-subtle overflow-hidden">
      {/* Header com Abas */}
      <div className="p-6 pb-0">
        <div className="flex items-center gap-3 mb-4">
          {isTic
            ? <Monitor className="w-8 h-8 text-brand-600" />
            : isBoasPraticas
              ? <FileText className="w-8 h-8 text-emerald-600" />
              : <Gavel className="w-8 h-8 text-amber-accent-deep" />
          }
          <div className="flex-1">
            <h2 className="text-xl font-bold text-ink-primary">
              {isTic ? 'Contratações de TIC' : isBoasPraticas ? 'Outros Atos Normativos' : 'Atos Normativos Infralegais'}
            </h2>
            <p className="text-sm text-ink-muted">
              {isTic
                ? 'Normativos sobre contratações de Tecnologia da Informação e Comunicação'
                : isBoasPraticas
                  ? 'Outros atos normativos relacionados a licitações e contratos'
                  : 'Decretos, portarias e instruções normativas que regulamentam a Lei 14.133/2021'}
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b-2 border-border-subtle">
          <button
            onClick={() => switchTab('atos')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm transition-colors -mb-[2px] border-b-2 ${
              activeTab === 'atos'
                ? 'text-amber-accent-deep border-amber-accent'
                : 'text-ink-muted border-transparent hover:text-amber-accent-deep'
            }`}
          >
            <Scale className="w-4 h-4" />
            Atos Normativos
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'atos' ? 'bg-amber-accent-soft text-amber-accent-deep' : 'bg-surface-deep text-ink-muted'
            }`}>
              {tabCounts.atos}
            </span>
          </button>
          <button
            onClick={() => switchTab('tic')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm transition-colors -mb-[2px] border-b-2 ${
              activeTab === 'tic'
                ? 'text-brand-700 border-brand-600'
                : 'text-ink-muted border-transparent hover:text-brand-600'
            }`}
          >
            <Monitor className="w-4 h-4" />
            TIC
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'tic' ? 'bg-brand-100 text-brand-700' : 'bg-surface-deep text-ink-muted'
            }`}>
              {tabCounts.tic}
            </span>
          </button>
          <button
            onClick={() => switchTab('boas-praticas')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm transition-colors -mb-[2px] border-b-2 ${
              activeTab === 'boas-praticas'
                ? 'text-emerald-700 border-emerald-600'
                : 'text-ink-muted border-transparent hover:text-emerald-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            Outros Atos
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'boas-praticas' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-deep text-ink-muted'
            }`}>
              {tabCounts.boasPraticas}
            </span>
          </button>
        </div>
      </div>

      {/* Busca + Filtros */}
      <div className="p-6">
        <ActsFilters
          search={search}
          setSearch={setSearch}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          issuerFilter={issuerFilter}
          setIssuerFilter={setIssuerFilter}
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          esferaFilter={esferaFilter}
          setEsferaFilter={setEsferaFilter}
          themeFilter={themeFilter}
          setThemeFilter={setThemeFilter}
          isBoasPraticas={isBoasPraticas}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          availableTypes={availableTypes}
          availableIssuers={availableIssuers}
          availableYears={availableYears}
          availableEsferas={availableEsferas}
          setPage={setPage}
        />

        {/* Count */}
        {!isLoading && (
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-1 text-sm text-ink-muted">
              <FileText className="w-4 h-4" />
              {total} {isTic
                ? (total === 1 ? 'ato de TIC' : 'atos de TIC')
                : isBoasPraticas
                  ? (total === 1 ? 'outro ato normativo' : 'outros atos normativos')
                  : (total === 1 ? 'ato normativo' : 'atos normativos')}
              {hasActiveFilters && ' encontrado(s)'}
            </span>
            {totalPages > 1 && (
              <span className="text-xs text-ink-muted">
                Pág. {page}/{totalPages}
              </span>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-8 h-8 animate-spin ${isTic ? 'text-brand-600' : isBoasPraticas ? 'text-emerald-600' : 'text-amber-accent-deep'}`} />
          </div>
        ) : acts.length === 0 ? (
          /* Empty state */
          <div className="text-center py-12">
            {isBoasPraticas ? (
              <>
                <FileText className="w-12 h-12 text-ink-muted mx-auto mb-3" />
                <p className="text-ink-muted font-medium">Nenhum ato normativo encontrado</p>
                <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Tente ajustar os filtros ou busca.'
                    : 'Outros atos normativos de órgãos federais e estaduais são adicionados regularmente.'}
                </p>
              </>
            ) : (
              <>
                <Gavel className="w-12 h-12 text-ink-muted mx-auto mb-3" />
                <p className="text-ink-muted font-medium">Nenhum ato normativo encontrado.</p>
              </>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className={`mt-3 text-sm font-medium ${isTic ? 'text-brand-600 hover:text-brand-700' : isBoasPraticas ? 'text-emerald-600 hover:text-emerald-700' : 'text-amber-accent-deep hover:text-amber-accent-deep'}`}
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          /* Acts list */
          <div className="space-y-3">
            {acts.map((act) => (
              <ActCard
                key={act.id}
                act={act}
                expandedAct={expandedAct}
                setExpandedAct={setExpandedAct}
                isBoasPraticas={isBoasPraticas}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}

        {/* Paginacao */}
        {!isLoading && totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border-2 border-border-subtle rounded-[6px] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-raised transition-colors"
            >
              Anterior
            </button>
            <span className="px-3 py-2 text-sm text-ink-muted font-medium">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border-2 border-border-subtle rounded-[6px] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-raised transition-colors"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
