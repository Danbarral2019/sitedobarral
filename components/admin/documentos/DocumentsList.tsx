'use client';

import { FileText, Search, Plus } from 'lucide-react';
import { DocumentCard, type DocumentData } from '@/components/admin/DocumentCard';
import { Pagination } from '@/components/ui/pagination';

interface DocumentsListProps {
  documents: DocumentData[];
  filtered: DocumentData[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onPreview: (doc: DocumentData) => void;
  onDelete: (id: string) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function DocumentsList({
  documents,
  filtered,
  loading,
  selectedIds,
  onSelect,
  onPreview,
  onDelete,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: DocumentsListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
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
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="font-medium">Nenhum documento encontrado</p>
        <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {filtered.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            isSelected={selectedIds.has(doc.id)}
            onSelect={onSelect}
            onPreview={onPreview}
            onDelete={onDelete}
          />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        itemsPerPage={itemsPerPage}
        totalItems={totalItems}
      />
    </>
  );
}
