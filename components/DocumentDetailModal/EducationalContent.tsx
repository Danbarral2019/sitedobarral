import {
  BookOpen,
  Target,
  Lightbulb,
  Scale,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { normalizeTextContent } from '@/lib/utils';
import { isLiteralSourceCategory } from '@/lib/literal-sources';
import type { DocumentData } from './index';

interface EducationalContentProps {
  document: DocumentData;
  summary: string | null;
  keyPoints: string[];
  tags: string[];
  leiArticles: string[];
  onClose: () => void;
}

export default function EducationalContent({
  document,
  summary,
  keyPoints,
  tags,
  leiArticles,
  onClose,
}: EducationalContentProps) {
  // Fontes literais (enunciados): exibem `description` como texto-fonte e NUNCA
  // mostram summary IA. Outras categorias: mostram summary quando presente, com
  // description como fallback. Ver lib/literal-sources.ts.
  const isLiteral = isLiteralSourceCategory(document.category);

  return (
    <>
      {/* Texto-fonte (enunciados): exibido na íntegra, sem reescrita IA */}
      {isLiteral && document.description && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">Texto do Enunciado</h3>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <p className="text-gray-800 leading-relaxed whitespace-pre-line">{document.description}</p>
          </div>
        </div>
      )}

      {/* Resumo IA (não-literais): bloco principal quando summary existe.
          Badge "não revisado" exibido até admin aprovar via summaryReviewedByAdmin. */}
      {!isLiteral && summary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 rounded-lg">
                <BookOpen className="w-5 h-5 text-surface-page" />
              </div>
              <h3 className="text-lg font-bold text-blue-900">Resumo</h3>
            </div>
            {!document.summaryReviewedByAdmin && (
              <span
                className="px-2 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-semibold inline-flex items-center gap-1"
                title="Resumo gerado por IA — ainda não foi revisado por um administrador. Pode conter imprecisões."
              >
                <span aria-hidden>⚠️</span> Resumo IA não revisado
              </span>
            )}
          </div>
          <div className="text-gray-800 leading-relaxed space-y-2">
            {normalizeTextContent(summary).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Pontos-Chave (admin-authored em DocumentNotes.keyPoints) */}
      {keyPoints.length > 0 && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Target className="w-5 h-5 text-surface-page" />
            </div>
            <h3 className="text-lg font-bold text-purple-900">Pontos-Chave</h3>
          </div>
          <ul className="space-y-2">
            {keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-surface-page rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                  {index + 1}
                </div>
                <p className="text-gray-800 flex-1">{point}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Aplicação Prática (admin-authored em DocumentNotes.practicalUse) */}
      {document.notes?.practicalUse && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-green-600 rounded-lg">
              <Lightbulb className="w-5 h-5 text-surface-page" />
            </div>
            <h3 className="text-lg font-bold text-green-900">Aplicacao Pratica</h3>
          </div>
          <div className="text-gray-800 leading-relaxed space-y-2">
            {normalizeTextContent(document.notes.practicalUse).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Observações do Prof. Barral (admin-authored em DocumentNotes.publicNotes) */}
      {document.notes?.publicNotes && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-amber-600 rounded-lg">
              <BookOpen className="w-5 h-5 text-surface-page" />
            </div>
            <h3 className="text-lg font-bold text-amber-900">Observacoes do Prof. Barral</h3>
          </div>
          <div className="text-gray-800 leading-relaxed italic space-y-2">
            {normalizeTextContent(document.notes.publicNotes).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Descrição (não-literais): exibida quando não há summary */}
      {!isLiteral && document.description && !summary && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">Descrição</h3>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <p className="text-gray-800 leading-relaxed">{document.description}</p>
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Linked Lei Articles */}
      {leiArticles.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            Artigos da Lei 14.133 Relacionados
          </h3>
          <div className="flex flex-wrap gap-2">
            {leiArticles.map((artNum) => (
              <Link
                key={artNum}
                href={`/area-restrita/artigo/${artNum}`}
                onClick={onClose}
                className="px-3 py-2 bg-blue-600 text-surface-page rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                Art. {artNum}
                <ChevronRight className="w-4 h-4" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
