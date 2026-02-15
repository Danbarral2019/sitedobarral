'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface VersionSnapshot {
  id: string;
  versionNumber: number;
  title: string;
  description: string;
  url: string;
  category: string;
  tags: string;
  onNumber: number | null;
  onYear: number | null;
  detectedAt: string;
}

interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: 'added' | 'removed' | 'modified';
  significance: 'low' | 'medium' | 'high';
}

interface CompareResult {
  version1: VersionSnapshot;
  version2: VersionSnapshot;
  changes: FieldChange[];
  changesSummary: string;
}

interface Props {
  documentId: string;
  versionId1: string;
  versionId2: string;
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descrição',
  url: 'URL',
  category: 'Categoria',
  tags: 'Tags',
  onNumber: 'Número da ON',
  onYear: 'Ano da ON',
};

const SIGNIFICANCE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  high: { label: 'Alta', bg: 'bg-red-100', text: 'text-red-700' },
  medium: { label: 'Média', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low: { label: 'Baixa', bg: 'bg-gray-100', text: 'text-gray-600' },
};

export default function VersionDiffViewer({ documentId, versionId1, versionId2, onClose }: Props) {
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/documents/${documentId}/versions/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId1, versionId2 }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao comparar versões');
        }
        const data = await res.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [documentId, versionId1, versionId2]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        {result ? (
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span>Versão {result.version1.versionNumber}</span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span>Versão {result.version2.versionNumber}</span>
            <span className="text-gray-400 text-xs ml-2">
              {formatDate(result.version1.detectedAt)} → {formatDate(result.version2.detectedAt)}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-500">Comparando versões...</span>
        )}
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
          aria-label="Fechar comparação"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-500">Carregando comparação...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* No changes */}
        {result && result.changes.length === 0 && !loading && (
          <p className="text-sm text-gray-500 italic text-center py-4">
            Nenhuma diferença detectada entre estas versões.
          </p>
        )}

        {/* Changes list */}
        {result && result.changes.length > 0 && !loading && (
          <div className="space-y-3">
            {result.changesSummary && (
              <p className="text-sm text-gray-600 mb-3">{result.changesSummary}</p>
            )}

            {result.changes.map((change, idx) => {
              const sigStyle = SIGNIFICANCE_STYLES[change.significance] || SIGNIFICANCE_STYLES.low;
              return (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Field header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-700">
                      {FIELD_LABELS[change.field] || change.field}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${sigStyle.bg} ${sigStyle.text}`}
                    >
                      {sigStyle.label}
                    </span>
                  </div>

                  {/* Values */}
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    {/* Old value */}
                    <div className="p-3">
                      <span className="text-xs text-gray-400 block mb-1">Anterior</span>
                      <div className="text-sm bg-red-50 text-red-800 px-2 py-1.5 rounded break-all">
                        {change.oldValue || <span className="italic text-gray-400">(vazio)</span>}
                      </div>
                    </div>
                    {/* New value */}
                    <div className="p-3">
                      <span className="text-xs text-gray-400 block mb-1">Novo</span>
                      <div className="text-sm bg-green-50 text-green-800 px-2 py-1.5 rounded break-all">
                        {change.newValue || <span className="italic text-gray-400">(vazio)</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
