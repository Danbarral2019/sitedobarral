'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import DocumentWizard from '@/components/admin/DocumentWizard';
import { DocumentFormState } from '@/components/admin/DocumentWizard/types';
import { Loader2, ChevronDown, ChevronRight, History, CheckCircle2, AlertTriangle } from 'lucide-react';
import DocumentVersionHistory from '@/components/admin/DocumentVersionHistory';

interface DocumentFromAPI {
  id: string;
  title: string;
  description: string | null;
  url: string;
  type: 'pdf' | 'doc' | 'link' | 'video';
  category: string;
  courseId: string | null;
  isPublic: boolean;
  isCommon: boolean;
  tags: string[];
  leiArticles: string[];
  alternativeUrls: string | null;
  summary?: string | null;
  summaryReviewedByAdmin?: boolean | null;
  summaryReviewedAt?: string | null;
  summaryReviewedBy?: string | null;
  keyPoints?: string | null;
  practicalUse?: string | null;
  publicNotes?: string | null;
  importance?: string | null;
  adminNotes?: string | null;
  entityType?: string | null;
  enunciadoNumber?: string | null;
}

export default function EditDocumentPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Partial<DocumentFormState> | null>(null);
  const [versionCount, setVersionCount] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [summaryInfo, setSummaryInfo] = useState<{
    hasSummary: boolean;
    reviewed: boolean;
    reviewedAt: string | null;
    reviewedBy: string | null;
  } | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  // Carregar documento existente
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/documents/${documentId}`);

        if (!response.ok) {
          throw new Error('Documento não encontrado');
        }

        const doc: DocumentFromAPI = await response.json();

        // Mapear dados do documento para o formato do wizard
        const wizardData: Partial<DocumentFormState> = {
          // Step 1: Basic Info
          title: doc.title,
          description: doc.description || '',
          category: doc.category as DocumentFormState['category'],
          courseId: doc.courseId || '',
          isPublic: doc.isPublic,
          isCommon: doc.isCommon,
          url: doc.url,
          type: doc.type,
          entityType: doc.entityType || '',
          enunciadoNumber: doc.enunciadoNumber || '',

          // Step 2: Lei Articles & Tags
          leiArticles: Array.isArray(doc.leiArticles)
            ? doc.leiArticles
            : typeof doc.leiArticles === 'string'
            ? JSON.parse(doc.leiArticles || '[]')
            : [],
          tags: Array.isArray(doc.tags)
            ? doc.tags
            : typeof doc.tags === 'string'
            ? JSON.parse(doc.tags || '[]')
            : [],

          // Step 3: Educational Content
          summary: doc.summary || '',
          keyPoints: doc.keyPoints || '',
          practicalUse: doc.practicalUse || '',
          publicNotes: doc.publicNotes || '',

          // Step 4: Finalization
          importance: (doc.importance as DocumentFormState['importance']) || '',
          adminNotes: doc.adminNotes || '',
          alternativeUrls: doc.alternativeUrls
            ? JSON.parse(doc.alternativeUrls)
            : [],
        };

        setInitialData(wizardData);
        setSummaryInfo({
          hasSummary: !!doc.summary,
          reviewed: !!doc.summaryReviewedByAdmin,
          reviewedAt: doc.summaryReviewedAt ?? null,
          reviewedBy: doc.summaryReviewedBy ?? null,
        });

        // Buscar contagem de versões (não bloqueia o carregamento principal)
        fetch(`/api/admin/documents/${documentId}/versions`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) setVersionCount(data.versionCount);
          })
          .catch(() => {});
      } catch (err) {
        console.error('[Edit Document] Erro ao carregar:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar documento');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId]);

  async function toggleSummaryReview() {
    if (!summaryInfo) return;
    setReviewBusy(true);
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/mark-summary-reviewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: !summaryInfo.reviewed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error ?? 'Erro ao atualizar status de revisão');
        return;
      }
      const data = await res.json();
      setSummaryInfo({
        hasSummary: true,
        reviewed: data.document.summaryReviewedByAdmin,
        reviewedAt: data.document.summaryReviewedAt,
        reviewedBy: data.document.summaryReviewedBy,
      });
    } finally {
      setReviewBusy(false);
    }
  }

  return (
      <div className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Carregando documento...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h2 className="text-xl font-bold text-red-900 mb-2">Erro ao Carregar Documento</h2>
              <p className="text-red-700 mb-4">{error}</p>
              <a
                href="/admin/documentos"
                className="inline-block px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                ← Voltar para Lista de Documentos
              </a>
            </div>
          </div>
        )}

        {/* Wizard */}
        {!loading && !error && initialData && (
          <>
            <div className="max-w-4xl mx-auto mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Editar Documento</h1>
              <p className="text-gray-600">
                Atualize as informações do documento usando o wizard multi-etapas
              </p>
            </div>

            <DocumentWizard documentId={documentId} initialData={initialData} />

            {/* Aprovação humana do resumo IA */}
            {summaryInfo?.hasSummary && (
              <div className="max-w-4xl mx-auto mt-8">
                {summaryInfo.reviewed ? (
                  <div className="flex items-center justify-between gap-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-900">Resumo IA aprovado</p>
                        <p className="text-sm text-green-700">
                          Revisado em{' '}
                          {summaryInfo.reviewedAt
                            ? new Date(summaryInfo.reviewedAt).toLocaleString('pt-BR')
                            : '—'}
                          {summaryInfo.reviewedBy ? ` por ${summaryInfo.reviewedBy}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleSummaryReview}
                      disabled={reviewBusy}
                      className="px-4 py-2 text-sm bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
                    >
                      Desmarcar revisão
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900">Resumo IA pendente de revisão</p>
                        <p className="text-sm text-amber-700">
                          Os alunos veem um aviso &quot;Resumo IA não revisado&quot; até você aprovar.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleSummaryReview}
                      disabled={reviewBusy}
                      className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 font-semibold"
                    >
                      {reviewBusy ? 'Processando…' : 'Marcar como revisado'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Histórico de Versões — collapsible */}
            <div className="max-w-4xl mx-auto mt-8">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="flex items-center gap-2 w-full text-left px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <History className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-gray-700">
                  Histórico de Versões
                  {versionCount !== null && (
                    <span className="ml-1.5 text-sm text-gray-500">({versionCount})</span>
                  )}
                </span>
                {historyOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                )}
              </button>

              {historyOpen && (
                <div className="mt-3 px-1">
                  <DocumentVersionHistory documentId={documentId} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
  );
}
