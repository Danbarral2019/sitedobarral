'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Loader2,
  AlertCircle,
  Target,
  Lightbulb,
  Scale,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Heart,
} from 'lucide-react';
import { useFavorites } from '@/hooks/use-favorites';
import { useLegislativeActFavorites } from '@/hooks/use-legislative-act-favorites';
import { safeParseArray, normalizeTextContent } from '@/lib/utils';
import { parseLeiArticles, getLeiArticles } from '@/lib/lei-articles';
import { isLiteralSourceCategory } from '@/lib/literal-sources';

interface DocumentNotes {
  adminNotes?: string | null;
  publicNotes?: string | null;
  importance?: string | null;
  practicalUse?: string | null;
  keyPoints?: string | null;
}

interface DocumentData {
  id: string;
  title: string;
  description: string | null;
  /** Texto integral da fonte. `description` costuma ser só um extrato/curadoria. */
  content: string | null;
  category: string;
  type: 'pdf' | 'doc' | 'link' | 'video';
  url: string;
  uploadedAt: string;
  tags: string | null;
  leiArticles: string | null;
  courseId: string | null;
  summary: string | null;
  keyPoints: string | null;
  practicalUse: string | null;
  publicNotes: string | null;
  importance: string | null;
  notesKeyPoints?: string | null;
  notesPracticalUse?: string | null;
  notesImportance?: string | null;
  notes?: DocumentNotes | null;
}

interface LeiDocumentDetailsProps {
  documentId: string;
  documentType?: string;
}

function logAccess(action: 'view' | 'download', document: DocumentData | null) {
  fetch('/api/access-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      documentId: document?.id,
      courseId: document?.courseId,
    }),
  }).catch(console.error);
}

export function LeiDocumentDetails({ documentId, documentType = 'document' }: LeiDocumentDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [showFullText, setShowFullText] = useState(false);

  const docFavorites = useFavorites();
  const actFavorites = useLegislativeActFavorites();

  const isLegislativeAct = documentType === 'legislativeAct';
  const isFavorite = isLegislativeAct ? actFavorites.isFavorite : docFavorites.isFavorite;

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiUrl = isLegislativeAct
          ? `/api/legislative-acts/${documentId}`
          : `/api/documents/${documentId}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(isLegislativeAct ? 'Ato normativo não encontrado' : 'Documento não encontrado');
        }
        const data = await response.json();
        setDocument(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar documento');
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [documentId, isLegislativeAct]);

  if (loading) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg border-t border-gray-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p className="text-center text-gray-600 mt-3">Carregando detalhes...</p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="bg-red-50 p-6 rounded-lg border-t border-red-200">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
        <p className="text-center text-red-700">{error || 'Documento não encontrado'}</p>
      </div>
    );
  }

  const tags = safeParseArray(document.tags);
  const leiArticles = getLeiArticles(document);
  const effectiveKeyPoints = document.notes?.keyPoints ?? document.keyPoints ?? document.notesKeyPoints;
  const effectivePracticalUse = document.notes?.practicalUse ?? document.practicalUse ?? document.notesPracticalUse;
  const effectivePublicNotes = document.notes?.publicNotes ?? document.publicNotes;
  const keyPoints = effectiveKeyPoints ? effectiveKeyPoints.split('\n').filter((p) => p.trim()) : [];
  const isLiteral = isLiteralSourceCategory(document.category);

  // Só oferece a íntegra quando ela acrescenta algo: em muitos registros o
  // `content` é a própria `description` (o scraper da AGU grava os dois iguais).
  const fullText = document.content?.trim() ?? '';
  const hasFullText =
    fullText.length > 0 && fullText !== (document.description ?? '').trim();

  const isExternalLikeDoc =
    document.url &&
    (document.type === 'link' || ['decreto', 'in', 'portaria', 'lei', 'medida-provisoria'].includes(document.type || ''));

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-lg border-t border-gray-200 space-y-4">
      {isLiteral && document.description && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-blue-900 text-sm">Texto do Enunciado</h4>
          </div>
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{document.description}</p>
        </div>
      )}

      {!isLiteral && document.summary && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-blue-900 text-sm">Resumo</h4>
          </div>
          <div className="space-y-2">
            {normalizeTextContent(document.summary).map((p, i) => (
              <p key={i} className="text-gray-800 text-sm leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      )}

      {keyPoints.length > 0 && (
        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-purple-600" />
            <h4 className="font-bold text-purple-900 text-sm">Pontos-Chave</h4>
          </div>
          <ul className="space-y-2">
            {keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <p className="text-gray-800">{point}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {effectivePracticalUse && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-green-600" />
            <h4 className="font-bold text-green-900 text-sm">Aplicação Prática</h4>
          </div>
          <div className="space-y-2">
            {normalizeTextContent(effectivePracticalUse).map((p, i) => (
              <p key={i} className="text-gray-800 text-sm leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      )}

      {effectivePublicNotes && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <h4 className="font-bold text-amber-900 text-sm">Observações do Prof. Barral</h4>
          </div>
          <div className="space-y-2">
            {normalizeTextContent(effectivePublicNotes).map((p, i) => (
              <p key={i} className="text-gray-800 text-sm leading-relaxed italic">{p}</p>
            ))}
          </div>
        </div>
      )}

      {!isLiteral && document.description && !document.summary && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <h4 className="font-bold text-gray-900 text-sm mb-2">Descrição</h4>
          <p className="text-gray-800 text-sm leading-relaxed">{document.description}</p>
        </div>
      )}

      {/*
        Texto integral. Antes, esta tela só mostrava `description` — que para as
        ONs é um extrato (a ON 94/2024 exibia apenas o inciso I, embora o texto
        completo estivesse no banco). Colapsado por padrão: `content` pode passar
        de 30 mil caracteres em acórdãos.
        Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
      */}
      {hasFullText && (
        <div className="bg-white border-l-4 border-gray-400 p-4 rounded-r-lg">
          <button
            type="button"
            onClick={() => setShowFullText((v) => !v)}
            aria-expanded={showFullText}
            className="flex items-center gap-2 w-full text-left group"
          >
            <FileText className="w-4 h-4 text-gray-600" />
            <h4 className="font-bold text-gray-900 text-sm flex-1 group-hover:text-blue-700 transition-colors">
              Texto integral
            </h4>
            <ChevronRight
              className={`w-4 h-4 text-gray-500 transition-transform ${showFullText ? 'rotate-90' : ''}`}
            />
          </button>
          {showFullText && (
            <div className="mt-3 max-h-96 overflow-y-auto pr-2">
              <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">
                {document.content}
              </p>
            </div>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-900 text-sm mb-2">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {leiArticles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-gray-900 text-sm">Artigos Relacionados</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {leiArticles.map((artNum) => (
              <Link
                key={artNum}
                href={`/area-restrita/lei-comentada?artigo=${artNum}`}
                className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                Art. {artNum}
                <ChevronRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-gray-200 flex gap-2">
        <button
          onClick={() => {
            if (isLegislativeAct) {
              actFavorites.toggleFavorite(documentId);
            } else {
              docFavorites.toggleFavorite(documentId, document?.courseId || '');
            }
          }}
          className={`px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
            isFavorite(documentId)
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          aria-label={isFavorite(documentId) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart className={`w-5 h-5 ${isFavorite(documentId) ? 'fill-current' : ''}`} />
        </button>

        {isExternalLikeDoc ? (
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logAccess('view', document)}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            Acessar Documento Oficial
          </a>
        ) : document.url ? (
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logAccess('view', document)}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-5 h-5" />
            Acessar Link Externo
          </a>
        ) : (
          <a
            href={`/api/documents/${documentId}/download`}
            onClick={() => logAccess('download', document)}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download do Arquivo
          </a>
        )}
      </div>
    </div>
  );
}
