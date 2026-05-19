'use client';

import { useAdicionarDocumentos } from '@/hooks/use-adicionar-documentos';
import { StatsCards } from '@/components/admin/adicionar-documentos/StatsCards';
import { UploadSection } from '@/components/admin/adicionar-documentos/UploadSection';
import { AutoImportsList, type AutoImportDocument } from '@/components/admin/adicionar-documentos/AutoImportsList';
import { RecentUploadsList, type RecentUpload } from '@/components/admin/adicionar-documentos/RecentUploadsList';

interface Props {
  autoImports: AutoImportDocument[];
  autoImportsPagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  recentUploads: RecentUpload[];
}

export default function AdicionarDocumentosClient({
  autoImports,
  autoImportsPagination,
  recentUploads,
}: Props) {
  const a = useAdicionarDocumentos();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Central de Documentos</h1>
          <p className="text-gray-600">
            Upload de arquivos, criação manual e monitoramento de importações automáticas
          </p>
        </div>

        <StatsCards
          autoImportsTotal={autoImportsPagination.total}
          recentUploadsCount={recentUploads.length}
        />

        <UploadSection
          collapsed={a.sectionsCollapsed.upload}
          onToggle={() => a.toggleSection('upload')}
          uploadMode={a.uploadMode}
          onUploadModeChange={a.setUploadMode}
          creationMode={a.creationMode}
          onCreationModeChange={a.setCreationMode}
          formData={a.formData}
          onFormChange={a.setFormData}
          selectedFile={a.selectedFile}
          onFileSelect={a.handleFileSelect}
          onFileRemove={a.handleFileRemove}
          multipleFiles={a.multipleFiles}
          onMultipleFilesSelect={a.handleMultipleFilesSelect}
          onMultipleFileRemove={a.handleMultipleFileRemove}
          isUploading={a.isUploading}
          uploadProgress={a.uploadProgress}
          onUpload={a.handleUpload}
          onBulkUpload={a.handleBulkUpload}
          onManualCreate={a.handleManualCreate}
        />

        <AutoImportsList
          docs={autoImports}
          pagination={autoImportsPagination}
          collapsed={a.sectionsCollapsed.autoImports}
          onToggle={() => a.toggleSection('autoImports')}
          searchTerm={a.searchTerm}
          onSearchChange={a.setSearchTerm}
          categoryFilter={a.searchParams.get('category') || ''}
          onCategoryChange={(v) => a.updateFilter('category', v || null)}
          onPageChange={(page) => a.updateFilter('page', String(page))}
        />

        <RecentUploadsList
          docs={recentUploads}
          collapsed={a.sectionsCollapsed.recent}
          onToggle={() => a.toggleSection('recent')}
        />
      </div>
    </div>
  );
}
