'use client';

import { Star, FileText, Loader2 } from 'lucide-react';
import { HighlightCard } from './HighlightCard';
import { CategoryAccordion } from './CategoryAccordion';
import type { ArticleDocsResponse } from '@/hooks/use-lei14133-preview';

interface LeiArticleDocumentsProps {
  loading: boolean;
  data: ArticleDocsResponse | null;
  expandedCategories: Set<string>;
  onToggleCategory: (name: string) => void;
}

export function LeiArticleDocuments({ loading, data, expandedCategories, onToggleCategory }: LeiArticleDocumentsProps) {
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
                <CategoryAccordion
                  key={displayName}
                  displayName={displayName}
                  docs={docs}
                  expanded={expandedCategories.has(displayName)}
                  onToggle={() => onToggleCategory(displayName)}
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
