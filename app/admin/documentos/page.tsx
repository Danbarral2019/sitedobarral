'use client';

import dynamic from 'next/dynamic';
import { Loader2, Plus } from 'lucide-react';
import { courses } from '@/data/courses';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { DocumentPreview } from '@/components/ui/document-preview';
import {
  documentsToJson,
  documentsToCsv,
  buildExportFilename,
  filterDocumentsBySelection,
  downloadTextFile,
} from '@/lib/admin/document-export';
import { useDocumentosAdmin } from '@/hooks/use-documentos-admin';
import { DocumentsStatsCards } from '@/components/admin/documentos/DocumentsStatsCards';
import { DocumentsToolbar } from '@/components/admin/documentos/DocumentsToolbar';
import { BulkActionBar } from '@/components/admin/documentos/BulkActionBar';
import { DocumentsFilters } from '@/components/admin/documentos/DocumentsFilters';
import { DocumentsList } from '@/components/admin/documentos/DocumentsList';

const BatchClassifyPanel = dynamic(() => import('@/components/BatchClassifyPanel'), {
  loading: () => <Loader2 className="w-8 h-8 animate-spin text-blue-600" />,
  ssr: false,
});

const LeiCoverageDashboard = dynamic(() => import('@/components/admin/LeiCoverageDashboard'), {
  loading: () => <div className="h-32 bg-gray-100 animate-pulse rounded-lg" />,
  ssr: false,
});

export default function DocumentosPage() {
  const { success } = useToast();
  const docs = useDocumentosAdmin();

  const exportDocuments = (format: 'json' | 'csv') => {
    const docsToExport = filterDocumentsBySelection(docs.documents, docs.selectedDocuments);
    const filename = buildExportFilename(format);

    if (format === 'json') {
      downloadTextFile(documentsToJson(docsToExport), filename, 'application/json');
    } else {
      downloadTextFile(documentsToCsv(docsToExport, courses), filename, 'text/csv');
    }

    success('Exportacao concluida!', `${docsToExport.length} documentos exportados em ${format.toUpperCase()}`);
  };

  const handleStatusFilter = (status: 'complete' | 'warning' | 'critical') => {
    docs.setFilter('status', docs.filters.status === status ? '' : status);
  };

  if (docs.isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Documentos</h2>
              <p className="text-gray-600">Visualize, edite e organize os materiais dos cursos</p>
            </div>
            <a
              href="/admin/adicionar-documentos"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Adicionar Documentos
            </a>
          </div>

          <LeiCoverageDashboard />

          <DocumentsStatsCards
            total={docs.serverPagination?.total || 0}
            stats={docs.stats}
            activeStatus={docs.filters.status}
            onStatusClick={handleStatusFilter}
          />

          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
            <DocumentsToolbar
              loading={docs.isLoadingDocs}
              onRefresh={() => docs.loadDocuments(true)}
              onExportJson={() => exportDocuments('json')}
              onExportCsv={() => exportDocuments('csv')}
            />

            {docs.selectedDocuments.size > 0 && (
              <BulkActionBar
                count={docs.selectedDocuments.size}
                action={docs.bulkAction}
                onActionChange={docs.setBulkAction}
                onApply={docs.handleBulkAction}
                onClear={docs.clearSelection}
              />
            )}

            <DocumentsFilters
              searchTerm={docs.searchTerm}
              onSearchChange={docs.setSearchTerm}
              filters={docs.filters}
              onFilterChange={docs.setFilter}
              activeCount={docs.activeFiltersCount}
              resultCount={docs.filteredDocuments.length}
              onClear={docs.clearFilters}
              selectedCount={docs.selectedDocuments.size}
              totalCount={docs.filteredDocuments.length}
              onSelectAll={docs.toggleSelectAll}
              onDeselectAll={docs.clearSelection}
            />

            <DocumentsList
              documents={docs.documents}
              filtered={docs.filteredDocuments}
              loading={docs.isLoadingDocs}
              selectedIds={docs.selectedDocuments}
              onSelect={docs.toggleDocumentSelection}
              onPreview={docs.handlePreviewClick}
              onDelete={docs.handleDeleteClick}
              currentPage={docs.currentPage}
              totalPages={docs.totalPages}
              totalItems={docs.totalItems}
              itemsPerPage={docs.itemsPerPage}
              onPageChange={docs.setCurrentPage}
            />
          </div>
        </div>
      </div>

      <DocumentPreview
        open={docs.previewDialog.open}
        onOpenChange={docs.previewDialog.onOpenChange}
        document={docs.previewDialog.doc ? {
          title: docs.previewDialog.doc.title,
          description: docs.previewDialog.doc.description,
          type: docs.previewDialog.doc.type,
          url: docs.previewDialog.doc.url,
          size: docs.previewDialog.doc.size,
        } : null}
      />

      {docs.showClassifyPanel && (
        <BatchClassifyPanel
          selectedDocuments={docs.selectedDocuments}
          onClose={() => docs.setShowClassifyPanel(false)}
          onSuccess={() => {
            docs.loadDocuments(true);
            docs.clearSelection();
          }}
        />
      )}

      <AlertDialog
        open={docs.deleteDialog.open}
        onOpenChange={docs.deleteDialog.onOpenChange}
        title="Excluir documento?"
        description="Esta acao nao pode ser desfeita. O documento sera permanentemente removido do sistema."
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        onConfirm={docs.deleteDialog.onConfirm}
        variant="danger"
        isLoading={docs.isProcessing}
      />
    </>
  );
}
