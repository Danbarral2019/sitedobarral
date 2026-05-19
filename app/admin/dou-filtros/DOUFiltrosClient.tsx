'use client';

import dynamic from 'next/dynamic';
import { useDouFiltros } from '@/hooks/use-dou-filtros';
import { DOUFiltersPanel } from '@/components/admin/dou-filtros/DOUFiltersPanel';
import { DOUStatsDashboard } from '@/components/admin/dou-filtros/DOUStatsDashboard';
import { DOUBulkActionBar } from '@/components/admin/dou-filtros/DOUBulkActionBar';
import { DOUStagingList } from '@/components/admin/dou-filtros/DOUStagingList';
import { DOUSearchResults } from '@/components/admin/dou-filtros/DOUSearchResults';
import { DOUBulkApproveModal } from '@/components/admin/dou-filtros/DOUBulkApproveModal';

const DOUDocumentModal = dynamic(() =>
  import('@/components/DOUDocumentModal').then((mod) => ({ default: mod.DOUDocumentModal })),
);

export default function DOUFiltrosClient() {
  const d = useDouFiltros();

  return (
    <>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Filtros Avançados DOU</h1>
          <p className="text-gray-600">
            Configure filtros para buscar documentos específicos no Diário Oficial da União
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <DOUFiltersPanel
              filters={d.filters}
              onFiltersChange={d.setFilters}
              onSearch={d.handleSearch}
              onClear={d.handleClearFilters}
              isLoading={d.isLoading}
            />
          </div>

          <div className="lg:col-span-2">
            {d.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
                {d.error}
              </div>
            )}

            {d.stats && <DOUStatsDashboard stats={d.stats} />}

            {d.selectedIds.size > 0 && (
              <DOUBulkActionBar
                selectedCount={d.selectedIds.size}
                isAllSelected={d.isAllSelected}
                isProcessing={d.isBulkProcessing}
                onToggleSelectAll={d.toggleSelectAll}
                onClear={d.clearSelection}
                onBulkApprove={d.openBulkApproveModal}
                onBulkReject={d.handleBulkReject}
              />
            )}

            <DOUStagingList
              variant="auto-approved"
              isLoading={d.isAutoApprovedLoading}
              docs={d.autoApprovedDocs}
              selectedIds={d.selectedIds}
              onToggleSelect={d.toggleSelect}
              onView={d.handleViewStagingDoc}
            />

            <DOUStagingList
              variant="pending"
              isLoading={d.isPendingLoading}
              docs={d.pendingDocs}
              selectedIds={d.selectedIds}
              onToggleSelect={d.toggleSelect}
              onView={d.handleViewStagingDoc}
            />

            {d.searchResponse && (
              <DOUSearchResults
                data={d.searchResponse}
                selectedTab={d.selectedTab}
                onTabChange={d.setSelectedTab}
                onViewDetails={d.handleViewDetails}
              />
            )}

            {!d.searchResponse && !d.isLoading && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold mb-2">Configure os filtros e busque</h3>
                <p>
                  Use o painel à esquerda para configurar filtros avançados e encontrar documentos
                  específicos no DOU
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {d.isMounted && d.selectedDocument && d.isModalOpen && (
        <DOUDocumentModal
          isOpen={d.isModalOpen}
          onClose={() => d.setIsModalOpen(false)}
          document={d.selectedDocument}
          onApprove={d.handleApproveDocument}
          onReject={d.handleRejectDocument}
          isRejecting={d.isSubmitting}
          isApproving={d.isSubmitting}
        />
      )}

      {d.isMounted && (
        <DOUBulkApproveModal
          isOpen={d.isBulkModalOpen}
          selectedCount={d.selectedIds.size}
          importAs={d.bulkImportAs}
          onImportAsChange={d.setBulkImportAs}
          bulkCourses={d.bulkCourses}
          onBulkCoursesChange={d.setBulkCourses}
          bulkNotes={d.bulkNotes}
          onBulkNotesChange={d.setBulkNotes}
          isProcessing={d.isBulkProcessing}
          onClose={() => d.setIsBulkModalOpen(false)}
          onConfirm={d.handleBulkApprove}
        />
      )}
    </>
  );
}
