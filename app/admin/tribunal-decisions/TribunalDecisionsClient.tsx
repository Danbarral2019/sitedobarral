'use client';

import { Scale, Loader2 } from 'lucide-react';
import { useTribunalDecisions } from '@/hooks/use-tribunal-decisions';
import { TribunalStatsCards } from '@/components/admin/tribunal-decisions/TribunalStatsCards';
import { TribunalByTribunalStats } from '@/components/admin/tribunal-decisions/TribunalByTribunalStats';
import { TribunalScraperHealth } from '@/components/admin/tribunal-decisions/TribunalScraperHealth';
import { TribunalReviewFilters } from '@/components/admin/tribunal-decisions/TribunalReviewFilters';
import { TribunalBulkActionsBar } from '@/components/admin/tribunal-decisions/TribunalBulkActionsBar';
import { TribunalDecisionItem } from '@/components/admin/tribunal-decisions/TribunalDecisionItem';
import { TribunalDecisionsPagination } from '@/components/admin/tribunal-decisions/TribunalDecisionsPagination';

export default function TribunalDecisionsClient() {
  const td = useTribunalDecisions();

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Scale className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Jurisprudencia de Tribunais</h1>
        </div>
        <p className="text-gray-600">
          Gerencie decisoes de Tribunais de Contas e Judiciais sobre licitacoes e contratos
        </p>
      </div>

      <TribunalStatsCards stats={td.stats} loading={td.statsLoading} />

      {td.stats && <TribunalByTribunalStats byTribunal={td.stats.byTribunal} />}

      <TribunalScraperHealth
        loading={td.scraperHealthLoading}
        scrapers={td.scraperHealth}
        runningScrapers={td.runningScrapers}
        onRunScraper={td.handleRunScraper}
      />

      <div className="bg-white rounded-lg shadow-sm border">
        <TribunalReviewFilters
          stats={td.stats}
          availableTribunals={td.availableTribunals}
          activeTab={td.activeTab}
          onTabChange={td.setActiveTab}
          filterTribunal={td.filterTribunal}
          onTribunalChange={td.setFilterTribunal}
          searchText={td.searchText}
          onSearchChange={td.setSearchText}
          sortBy={td.sortBy}
          onSortChange={td.setSortBy}
        />

        {td.selectedIds.size > 0 && (
          <TribunalBulkActionsBar
            selectedCount={td.selectedIds.size}
            totalVisible={td.decisions.length}
            isProcessing={td.isBulkProcessing}
            onToggleSelectAll={td.toggleSelectAll}
            onClear={td.clearSelection}
            onBulkApprove={td.handleBulkApprove}
            onBulkReject={td.handleBulkReject}
          />
        )}

        <div className="divide-y">
          {td.decisionsLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-gray-500">Carregando decisoes...</p>
            </div>
          ) : td.decisions.length === 0 ? (
            <div className="p-12 text-center">
              <Scale className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">Nenhuma decisao encontrada</p>
              <p className="text-gray-400 text-sm mt-1">Tente ajustar os filtros selecionados</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-3 bg-gray-50 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={td.selectedIds.size === td.decisions.length && td.decisions.length > 0}
                  onChange={td.toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  Mostrando {td.decisions.length} de {td.totalDecisions} decisao(oes)
                </span>
              </div>

              {td.decisions.map((decision) => (
                <TribunalDecisionItem
                  key={decision.id}
                  decision={decision}
                  isSelected={td.selectedIds.has(decision.id)}
                  isExpanded={td.expandedIds.has(decision.id)}
                  onSelect={td.toggleSelect}
                  onExpand={td.toggleExpand}
                  onApprove={td.handleApprove}
                  onReject={td.handleReject}
                />
              ))}
            </>
          )}
        </div>

        <TribunalDecisionsPagination
          currentPage={td.currentPage}
          totalPages={td.totalPages}
          totalItems={td.totalDecisions}
          onPageChange={td.setCurrentPage}
        />
      </div>
    </div>
  );
}
