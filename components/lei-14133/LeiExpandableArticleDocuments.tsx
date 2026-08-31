'use client';

import {
  Star,
  FileText,
  Loader2,
  ChevronRight,
  ChevronDown,
  Scale,
} from 'lucide-react';
import { HighlightCard } from './HighlightCard';
import { DebatedVotoCard } from './DebatedVotoCard';
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
    <div className="bg-surface-page rounded-md border border-border-subtle p-6">
      {loading && !data ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        </div>
      ) : data ? (
        <>
          {data.debatedInVoto?.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="w-5 h-5 text-brand-600" />
                <h3 className="text-lg font-bold text-ink-primary">Debatido no voto</h3>
                <span className="text-sm text-ink-muted">
                  ({data.debatedInVoto.length} {data.debatedInVoto.length === 1 ? 'acórdão' : 'acórdãos'})
                </span>
              </div>
              <p className="text-sm text-ink-muted mb-4">
                Acórdãos do TCU em que este artigo foi <strong>razão de decidir</strong> — aplicado no voto,
                não citado de passagem.
              </p>
              <div className="space-y-3">
                {data.debatedInVoto.map((doc) => (
                  <DebatedVotoCard key={doc.id} doc={doc} />
                ))}
              </div>
            </section>
          )}

          {data.highlights.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-amber-accent fill-amber-accent" />
                <h3 className="text-lg font-bold text-ink-primary">Regulamentações em destaque</h3>
                <span className="text-sm text-ink-muted">
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
            <h3 className="text-base font-semibold text-ink-secondary mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-ink-muted" />
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
        <p className="text-sm text-ink-muted text-center py-4">
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
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface-raised hover:bg-surface-deep transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-brand-600 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-ink-muted flex-shrink-0" />
        )}
        <FileText className="w-5 h-5 text-brand-600 flex-shrink-0" />
        <h4 className="flex-1 font-semibold text-ink-primary text-sm">{displayName}</h4>
        <span className="px-2.5 py-0.5 bg-brand-600 text-surface-page rounded-full text-xs font-bold">{docs.length}</span>
      </button>

      {expanded && (
        <div className="bg-surface-page border-t border-border-subtle p-3 space-y-2">
          {docs.map((doc) => {
            const isDocExpanded = expandedDocumentId === doc.id;
            return (
              <div key={doc.id} className="border border-border-subtle rounded-lg overflow-hidden">
                <button
                  onClick={() => onToggleDocument(doc.id)}
                  className="w-full flex items-center gap-3 p-3 bg-surface-raised hover:bg-surface-raised transition-colors text-left"
                >
                  {isDocExpanded ? (
                    <ChevronDown className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ink-muted flex-shrink-0" />
                  )}
                  <FileText className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span className="flex-1 text-ink-primary text-sm font-medium line-clamp-1">{doc.title}</span>
                  {doc.isPublic && (
                    <span className="px-2 py-0.5 bg-surface-deep text-ink-secondary text-xs font-medium rounded">
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
