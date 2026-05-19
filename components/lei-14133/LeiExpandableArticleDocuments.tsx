'use client';

import {
  Star,
  FileText,
  Loader2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { HighlightCard } from './HighlightCard';
import { LeiDocumentDetails } from './LeiDocumentDetails';
import type { ArticleDocsResponse, EnrichedDoc } from '@/hooks/use-lei14133-preview';

interface LeiExpandableArticleDocumentsProps {
  loading: boolean;
  data: ArticleDocsResponse | null;
  expandedCategories: Set<string>;
  onToggleCategory: (name: string) => void;
  expandedDocumentId: string | null;
  onToggleDocument: (id: string) => void;
}

export function LeiExpandableArticleDocuments({
  loading,
  data,
  expandedCategories,
  onToggleCategory,
  expandedDocumentId,
  onToggleDocument,
}: LeiExpandableArticleDocumentsProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {loading && !data ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : data ? (
        <>
          {data.highlights.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h3 className="text-lg font-bold text-gray-900">Regulamentações em destaque</h3>
                <span className="text-sm text-gray-500">
                  ({data.highlights.length} de {data.total})
                </span>
              </div>
              <div className="space-y-3">
                {data.highlights.map((doc) => (
                  <HighlightCard key={doc.id} doc={doc} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              Todos os documentos relacionados ({data.total})
            </h3>
            <div className="space-y-2">
              {Object.entries(data.byCategory).map(([displayName, docs]) => (
                <CategoryWithExpandableDocs
                  key={displayName}
                  displayName={displayName}
                  docs={docs}
                  expanded={expandedCategories.has(displayName)}
                  onToggle={() => onToggleCategory(displayName)}
                  expandedDocumentId={expandedDocumentId}
                  onToggleDocument={onToggleDocument}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-gray-500 text-center py-4">
          Não foi possível carregar os documentos relacionados.
        </p>
      )}
    </div>
  );
}

function CategoryWithExpandableDocs({
  displayName,
  docs,
  expanded,
  onToggle,
  expandedDocumentId,
  onToggleDocument,
}: {
  displayName: string;
  docs: EnrichedDoc[];
  expanded: boolean;
  onToggle: () => void;
  expandedDocumentId: string | null;
  onToggleDocument: (id: string) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-blue-600 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <h4 className="flex-1 font-semibold text-gray-900 text-sm">{displayName}</h4>
        <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-xs font-bold">{docs.length}</span>
      </button>

      {expanded && (
        <div className="bg-white border-t border-gray-200 p-3 space-y-2">
          {docs.map((doc) => {
            const isDocExpanded = expandedDocumentId === doc.id;
            return (
              <div key={doc.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => onToggleDocument(doc.id)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 transition-colors text-left"
                >
                  {isDocExpanded ? (
                    <ChevronDown className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="flex-1 text-gray-900 text-sm font-medium line-clamp-1">{doc.title}</span>
                  {doc.isPublic && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                      Público
                    </span>
                  )}
                </button>
                {isDocExpanded && <LeiDocumentDetails documentId={doc.id} documentType={doc.type} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
