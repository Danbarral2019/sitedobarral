'use client';

import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Video,
  Scale,
  AlertCircle,
  Heart,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { safeParseArray } from '@/lib/utils';
import { parseLeiArticles, getLeiArticles } from '@/lib/lei-articles';
import { getImportanceBadge } from './utils';
import MetadataGrid from './MetadataGrid';
import DouPublicationBox from './DouPublicationBox';
import EducationalContent from './EducationalContent';
import ActionButtons from './ActionButtons';

interface DocumentDetailModalProps {
  documentId: string;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export interface DocumentMetaTcuData {
  numeroAcordao: string | null;
  area: string | null;
  tema: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: string | null;
}

export interface DocumentMetaDouData {
  url: string | null;
  data: string | null;
  secao: string | null;
  pagina: string | null;
  edicao: string | null;
}

export interface DocumentNotesData {
  publicNotes: string | null;
  importance: string | null;
  practicalUse: string | null;
  keyPoints: string | null;
}

export interface DocumentData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: 'pdf' | 'doc' | 'link' | 'video';
  url: string;
  uploadedAt: string;
  tags: string | null;
  leiArticles: string | null;
  courseId: string | null;

  // AI Summary (stays on Document)
  summary: string | null;
  summaryReviewedByAdmin?: boolean | null;

  // AGU-specific fields
  onNumber: number | null;
  onYear: number | null;
  acordaoNumero: number | null;
  acordaoAno: number | null;
  entityType: string | null;
  enunciadoNumber: string | null;
  issuerOrg: string | null;
  esfera: string | null;

  // Alternative URLs
  alternativeUrls: string | null;

  // Satellite tables (1:1 relations)
  metaTcu: DocumentMetaTcuData | null;
  metaDou: DocumentMetaDouData | null;
  notes: DocumentNotesData | null;
}

export default function DocumentDetailModal({
  documentId,
  onClose,
  isFavorite = false,
  onToggleFavorite,
}: DocumentDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);

  // Fetch document data
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/documents/${documentId}`);

        if (!response.ok) {
          throw new Error('Documento nao encontrado');
        }

        const data = await response.json();
        setDocument(data);
      } catch (err) {
        console.error('[Document Modal] Erro ao carregar:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar documento');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  // Parse arrays
  const parseTags = (tags: string | null): string[] => {
    return safeParseArray(tags);
  };

  const parseKeyPoints = (keyPoints: string | null): string[] => {
    if (!keyPoints) return [];
    return keyPoints.split('\n').filter(point => point.trim().length > 0);
  };

  // Download handler
  const handleDownload = () => {
    fetch('/api/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'download',
        documentId: document?.id,
        courseId: document?.courseId,
      }),
    }).catch(console.error);
  };

  const handleView = () => {
    fetch('/api/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'view',
        documentId: document?.id,
        courseId: document?.courseId,
      }),
    }).catch(console.error);
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close on Escape key
  useEffect(() => {
    if (typeof window === 'undefined' || !window.document) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.document.addEventListener('keydown', handleEscape);
    return () => window.document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Loading state
  if (loading) {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando documento...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !document) {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-900 mb-2">Erro ao Carregar</h2>
            <p className="text-red-700 mb-4">{error || 'Documento nao encontrado'}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tags = parseTags(document.tags);
  const leiArticles = getLeiArticles(document);
  const keyPoints = parseKeyPoints(document.notes?.keyPoints ?? null);
  const importanceBadge = getImportanceBadge(document.notes?.importance ?? null);

  // Determine the best URL to use
  const douUrl = document.metaDou?.url ?? null;
  const primaryUrl = document.url || douUrl || '';
  const hasDouUrl = !!douUrl && douUrl !== primaryUrl;

  // Build document identifier string (ON n/ano, Acordao n/ano, etc.)
  const documentIdentifier = (() => {
    if (document.onNumber && document.onYear) {
      return `ON AGU n. ${document.onNumber}/${document.onYear}`;
    }
    if (document.acordaoNumero && document.acordaoAno) {
      return `Acordao n. ${document.acordaoNumero}/${document.acordaoAno}`;
    }
    if (document.metaTcu?.numeroAcordao) {
      return document.metaTcu.numeroAcordao;
    }
    if (document.enunciadoNumber && document.entityType) {
      return `Enunciado ${document.entityType} n. ${document.enunciadoNumber}`;
    }
    return null;
  })();

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-2xl z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                {document.type === 'video' ? (
                  <Video className="w-6 h-6" />
                ) : (
                  <FileText className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1">{document.title}</h2>

                {/* Document identifier and importance */}
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {documentIdentifier && (
                    <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
                      {documentIdentifier}
                    </span>
                  )}
                  {importanceBadge && (
                    <span className="text-xs font-semibold bg-white/25 px-2.5 py-1 rounded-full">
                      {importanceBadge.label}
                    </span>
                  )}
                </div>

                {/* Breadcrumbs - Lei 14.133 */}
                {leiArticles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-blue-100 mt-2">
                    <Scale className="w-4 h-4" />
                    <span>Lei 14.133/2021</span>
                    {leiArticles.slice(0, 3).map((artNum) => (
                      <div key={artNum} className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3" />
                        <Link
                          href={`/area-restrita/artigo/${artNum}`}
                          onClick={onClose}
                          className="hover:text-white underline transition-colors"
                        >
                          Art. {artNum}
                        </Link>
                      </div>
                    ))}
                    {leiArticles.length > 3 && (
                      <span className="text-blue-200">+{leiArticles.length - 3} mais</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 ml-2">
              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  className={`p-2 rounded-lg transition-colors ${
                    isFavorite
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                  aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <MetadataGrid document={document} />

          <DouPublicationBox
            document={document}
            handleView={handleView}
          />

          <EducationalContent
            document={document}
            summary={document.summary}
            keyPoints={keyPoints}
            tags={tags}
            leiArticles={leiArticles}
            onClose={onClose}
          />

          <ActionButtons
            document={document}
            documentId={documentId}
            primaryUrl={primaryUrl}
            hasDouUrl={hasDouUrl}
            handleDownload={handleDownload}
            handleView={handleView}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
