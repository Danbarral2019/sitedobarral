'use client';

import { FileText, Link as LinkIcon, Unlink, Search, Loader2 } from 'lucide-react';
import type { LessonDocumentData, SearchableDoc } from '@/hooks/use-lesson-editor';

const CATEGORY_LABELS: Record<string, string> = {
  apostila: 'Apostila',
  acordao: 'Acordao',
  parecer: 'Parecer',
  edital: 'Edital',
  artigo: 'Artigo',
  'orientacao-normativa': 'ON',
  decor: 'DECOR',
  enunciado: 'Enunciado',
  'manual-tcu': 'Manual TCU',
  outro: 'Outro',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] || cat;
}

interface LessonDocumentsTabProps {
  linkedDocuments: LessonDocumentData[];
  showSearch: boolean;
  onToggleSearch: () => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  filteredDocs: SearchableDoc[];
  linkedDocIds: Set<string>;
  isLoadingDocs: boolean;
  onLink: (docId: string) => void;
  onUnlink: (lessonDocId: string) => void;
  onToggleRequired: (lessonDoc: LessonDocumentData) => void;
}

export function LessonDocumentsTab({
  linkedDocuments,
  showSearch,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  filteredDocs,
  linkedDocIds,
  isLoadingDocs,
  onLink,
  onUnlink,
  onToggleRequired,
}: LessonDocumentsTabProps) {
  const sorted = [...linkedDocuments].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Documentos Vinculados</h3>
        <button
          onClick={onToggleSearch}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <LinkIcon className="w-4 h-4" />
          Vincular Documento
        </button>
      </div>

      {linkedDocuments.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          Nenhum documento vinculado
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {sorted.map((ld) => (
            <div key={ld.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{ld.document.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                    {categoryLabel(ld.document.category)}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {ld.document.type}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onToggleRequired(ld)}
                className={`text-xs px-2 py-1 rounded font-medium ${
                  ld.isRequired
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {ld.isRequired ? 'Obrigatorio' : 'Opcional'}
              </button>
              <button
                onClick={() => onUnlink(ld.id)}
                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                title="Desvincular"
              >
                <Unlink className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showSearch && (
        <div className="border-t border-gray-200 pt-4">
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar documentos..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
              autoFocus
            />
          </div>
          {isLoadingDocs ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredDocs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum documento encontrado</p>
              ) : (
                filteredDocs.map((doc) => {
                  const isLinked = linkedDocIds.has(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                        isLinked ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 truncate text-gray-900">{doc.title}</span>
                      <span className="text-xs text-gray-500">{categoryLabel(doc.category)}</span>
                      {isLinked ? (
                        <span className="text-xs text-green-600 font-medium">Vinculado</span>
                      ) : (
                        <button
                          onClick={() => onLink(doc.id)}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
                        >
                          Vincular
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
