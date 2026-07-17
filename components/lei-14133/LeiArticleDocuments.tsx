'use client';

import { Star, FileText, Loader2, Scale } from 'lucide-react';
import { HighlightCard } from './HighlightCard';
import { DebatedVotoCard } from './DebatedVotoCard';
import { CategoryAccordion } from './CategoryAccordion';
import type { ArticleDocsResponse } from '@/hooks/use-lei14133-preview';

interface LeiArticleDocumentsProps {
  loading: boolean;
  data: ArticleDocsResponse | null;
  expandedCategories: Set<string>;
  onToggleCategory: (name: string) => void;
}

/** Chave da seção temática no set de expandidos — não é uma categoria real. */
const THEME_SECTION = '__tema__';

export function LeiArticleDocuments({ loading, data, expandedCategories, onToggleCategory }: LeiArticleDocumentsProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {loading && !data ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : data ? (
        <>
          {data.debatedInVoto?.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">Debatido no voto</h3>
                <span className="text-sm text-gray-500">
                  ({data.debatedInVoto.length} {data.debatedInVoto.length === 1 ? 'acórdão' : 'acórdãos'})
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
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
              Documentos que citam este artigo ({data.total})
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

          {/*
            Vinculados por tema, não por citação. Ficam à parte e rotulados pelo
            que são: o vínculo vem de um LLM instruído a incluir artigos
            relacionados ao tema mesmo sem menção. Misturá-los aos que citam
            inflava o art. 5º para 1.134 documentos, dos quais só 39% o citam —
            número que faz o aluno duvidar de todos os outros.
            Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
          */}
          {data.relatedByTheme?.length > 0 && (
            <section className="mt-6 pt-6 border-t border-gray-200">
              <CategoryAccordion
                displayName="Relacionados por tema (não citam o artigo)"
                docs={data.relatedByTheme}
                expanded={expandedCategories.has(THEME_SECTION)}
                onToggle={() => onToggleCategory(THEME_SECTION)}
              />
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                Tratam de assunto próximo ao do artigo, mas não o mencionam. Sugeridos
                automaticamente — confira a pertinência antes de citar.
              </p>
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500 text-center py-4">
          Não foi possível carregar os documentos relacionados.
        </p>
      )}
    </div>
  );
}
