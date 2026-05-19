'use client';

import dynamic from 'next/dynamic';
import {
  FileText, Loader2, Search, Filter, X, Download,
  CheckSquare, Square, Plus, RefreshCw,
  AlertTriangle, CheckCircle, AlertCircle
} from 'lucide-react';
import { courses } from '@/data/courses';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { DocumentPreview } from '@/components/ui/document-preview';
import { Pagination } from '@/components/ui/pagination';
import { DocumentCard } from '@/components/admin/DocumentCard';
import {
  documentsToJson,
  documentsToCsv,
  buildExportFilename,
  filterDocumentsBySelection,
  downloadTextFile,
} from '@/lib/admin/document-export';
import { useDocumentosAdmin } from '@/hooks/use-documentos-admin';

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
          {/* Header */}
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

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{docs.serverPagination?.total || 0}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                docs.filters.status === 'complete' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
              }`}
              onClick={() => docs.setFilter('status', docs.filters.status === 'complete' ? '' : 'complete')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{docs.stats.complete}</p>
                  <p className="text-xs text-gray-500">Completos</p>
                </div>
              </div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                docs.filters.status === 'warning' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-300'
              }`}
              onClick={() => docs.setFilter('status', docs.filters.status === 'warning' ? '' : 'warning')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{docs.stats.warning}</p>
                  <p className="text-xs text-gray-500">Incompletos</p>
                </div>
              </div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                docs.filters.status === 'critical' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'
              }`}
              onClick={() => docs.setFilter('status', docs.filters.status === 'critical' ? '' : 'critical')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{docs.stats.critical}</p>
                  <p className="text-xs text-gray-500">Criticos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
            {/* Header with actions */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Documentos Cadastrados</h2>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => docs.loadDocuments(true)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
                  title="Recarregar"
                  disabled={docs.isLoadingDocs}
                >
                  <RefreshCw className={`w-4 h-4 ${docs.isLoadingDocs ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => exportDocuments('json')}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
                  title="Exportar JSON"
                >
                  <Download className="w-4 h-4" />
                  JSON
                </button>
                <button
                  onClick={() => exportDocuments('csv')}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
                  title="Exportar CSV"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
              </div>
            </div>

            {/* Bulk Action Bar */}
            {docs.selectedDocuments.size > 0 && (
              <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-bold text-blue-900">
                    {docs.selectedDocuments.size} selecionado{docs.selectedDocuments.size !== 1 ? 's' : ''}
                  </span>

                  <select
                    value={docs.bulkAction}
                    onChange={(e) => docs.setBulkAction(e.target.value)}
                    className="px-3 py-1.5 border-2 border-blue-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione uma acao</option>
                    <option value="classify">Classificar Automaticamente (IA)</option>
                    <option value="markReviewed">Marcar como Revisado</option>
                    <option value="delete">Deletar selecionados</option>
                  </select>

                  <button
                    onClick={docs.handleBulkAction}
                    disabled={!docs.bulkAction}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Aplicar
                  </button>

                  <button
                    onClick={docs.clearSelection}
                    className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Limpar selecao
                  </button>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por titulo ou descricao..."
                  value={docs.searchTerm}
                  onChange={(e) => docs.setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <select
                  value={docs.filters.course}
                  onChange={(e) => docs.setFilter('course', e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                >
                  <option value="">Todos os cursos</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>

                <select
                  value={docs.filters.category}
                  onChange={(e) => docs.setFilter('category', e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                >
                  <option value="">Todas categorias</option>
                  <option value="apostila">Apostila</option>
                  <option value="acordao">Acordao</option>
                  <option value="parecer">Parecer</option>
                  <option value="orientacao-normativa">Orientacao Normativa (AGU)</option>
                  <option value="enunciados">Enunciados</option>
                  <option value="sumula">Sumula</option>
                  <option value="edital">Edital</option>
                  <option value="artigo">Artigo</option>
                  <option value="outro">Outro</option>
                </select>

                <select
                  value={docs.filters.type}
                  onChange={(e) => docs.setFilter('type', e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                >
                  <option value="">Todos os tipos</option>
                  <option value="pdf">PDF</option>
                  <option value="doc">DOC/DOCX</option>
                  <option value="video">Video</option>
                  <option value="link">Link</option>
                </select>

                <select
                  value={docs.filters.visibility}
                  onChange={(e) => docs.setFilter('visibility', e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                >
                  <option value="">Todas visibilidades</option>
                  <option value="public">Publico</option>
                  <option value="private">Restrito</option>
                </select>

                <select
                  value={docs.filters.status}
                  onChange={(e) => docs.setFilter('status', e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                >
                  <option value="">Todos os status</option>
                  <option value="complete">Completos</option>
                  <option value="warning">Incompletos</option>
                  <option value="critical">Criticos</option>
                </select>
              </div>

              {docs.filters.category === 'enunciados' && (
                <div className="mt-3">
                  <select
                    value={docs.filters.entity}
                    onChange={(e) => docs.setFilter('entity', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 text-sm bg-blue-50"
                  >
                    <option value="">Todas as entidades</option>
                    <option value="IBDA">IBDA - Instituto Brasileiro de Direito Administrativo</option>
                    <option value="INCP">INCP - Instituto Nacional da Contratacao Publica</option>
                    <option value="CJF">CJF - Conselho da Justica Federal</option>
                  </select>
                </div>
              )}

              {(docs.activeFiltersCount > 0 || docs.searchTerm) && (
                <div className="flex items-center justify-between bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">
                      {docs.filteredDocuments.length} documento{docs.filteredDocuments.length !== 1 ? 's' : ''} encontrado{docs.filteredDocuments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={docs.clearFilters}
                    className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-100 px-3 py-1 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Limpar filtros
                  </button>
                </div>
              )}

              {docs.filteredDocuments.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={docs.toggleSelectAll}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    {docs.selectedDocuments.size === docs.filteredDocuments.length ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                    Selecionar todos ({docs.filteredDocuments.length})
                  </button>

                  {docs.selectedDocuments.size > 0 && (
                    <>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={docs.clearSelection}
                        className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Square className="w-5 h-5" />
                        Desselecionar todos
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Document List */}
            {docs.isLoadingDocs ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : docs.documents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nenhum documento cadastrado ainda</p>
                <a
                  href="/admin/adicionar-documentos"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar primeiro documento
                </a>
              </div>
            ) : docs.filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Nenhum documento encontrado</p>
                <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {docs.filteredDocuments.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      isSelected={docs.selectedDocuments.has(doc.id)}
                      onSelect={docs.toggleDocumentSelection}
                      onPreview={docs.handlePreviewClick}
                      onDelete={docs.handleDeleteClick}
                    />
                  ))}
                </div>

                <Pagination
                  currentPage={docs.currentPage}
                  totalPages={docs.totalPages}
                  onPageChange={docs.setCurrentPage}
                  itemsPerPage={docs.itemsPerPage}
                  totalItems={docs.totalItems}
                />
              </>
            )}
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
