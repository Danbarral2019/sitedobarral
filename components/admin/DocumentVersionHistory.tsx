'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, GitCompare, User, Bot, AlertCircle } from 'lucide-react';
import VersionDiffViewer from './VersionDiffViewer';

interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  description: string;
  url: string;
  category: string;
  tags: string;
  changeType: string;
  changesSummary: string | null;
  changeDetails: string | null;
  detectedAt: string;
  detectedBy: string | null;
  isCurrentVersion: boolean;
}

interface Props {
  documentId: string;
}

const CHANGE_TYPE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  created: { label: 'Criado', bg: 'bg-green-100', text: 'text-green-800' },
  major_update: { label: 'Atualização Major', bg: 'bg-red-100', text: 'text-red-800' },
  updated: { label: 'Atualizado', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  minor_update: { label: 'Atualização Minor', bg: 'bg-gray-100', text: 'text-gray-700' },
  no_change: { label: 'Sem Mudança', bg: 'bg-gray-50', text: 'text-gray-500' },
};

function SignificanceBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[120px]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{score}</span>
    </div>
  );
}

export default function DocumentVersionHistory({ documentId }: Props) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareState, setCompareState] = useState<{
    versionId1: string;
    versionId2: string;
  } | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/documents/${documentId}/versions`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao buscar histórico');
      }
      const data = await res.json();
      setVersions(data.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleCompare = (currentVersion: DocumentVersion, index: number) => {
    const previousVersion = versions[index + 1]; // versions são desc por versionNumber
    if (!previousVersion) return;
    setCompareState({
      versionId1: previousVersion.id,
      versionId2: currentVersion.id,
    });
  };

  // Loading
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex gap-4">
            <div className="w-3 h-3 rounded-full bg-gray-200 mt-1.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  // Empty
  if (versions.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        Nenhuma versão registrada para este documento.
      </p>
    );
  }

  // Diff viewer overlay
  if (compareState) {
    return (
      <VersionDiffViewer
        documentId={documentId}
        versionId1={compareState.versionId1}
        versionId2={compareState.versionId2}
        onClose={() => setCompareState(null)}
      />
    );
  }

  // Timeline
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {versions.map((version, index) => {
          const style = CHANGE_TYPE_STYLES[version.changeType] || CHANGE_TYPE_STYLES.no_change;
          const date = new Date(version.detectedAt);
          const formattedDate = date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          let significanceScore = 0;
          if (version.changeDetails) {
            try {
              const details = JSON.parse(version.changeDetails);
              if (Array.isArray(details)) {
                const high = details.filter((d: { significance: string }) => d.significance === 'high').length;
                const med = details.filter((d: { significance: string }) => d.significance === 'medium').length;
                const low = details.filter((d: { significance: string }) => d.significance === 'low').length;
                significanceScore = Math.min(100, high * 40 + med * 20 + low * 5);
              }
            } catch {
              // ignore
            }
          }
          if (version.changeType === 'created') {
            significanceScore = 100;
          }

          const hasPrevious = index < versions.length - 1;

          return (
            <div key={version.id} className="relative pl-6">
              {/* Dot */}
              <div
                className={`absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white ${
                  version.isCurrentVersion ? 'bg-blue-600' : 'bg-gray-400'
                }`}
              />

              <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">
                      v{version.versionNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                    {version.isCurrentVersion && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Atual
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formattedDate}
                  </div>
                </div>

                {/* Summary */}
                {version.changesSummary && (
                  <p className="text-sm text-gray-600 mb-2">{version.changesSummary}</p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* DetectedBy */}
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      {version.detectedBy === 'scraper' ? (
                        <Bot className="w-3 h-3" />
                      ) : (
                        <User className="w-3 h-3" />
                      )}
                      {version.detectedBy || 'desconhecido'}
                    </div>

                    {/* Significance */}
                    {significanceScore > 0 && version.changeType !== 'created' && (
                      <SignificanceBar score={significanceScore} />
                    )}
                  </div>

                  {/* Compare button */}
                  {hasPrevious && (
                    <button
                      onClick={() => handleCompare(version, index)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <GitCompare className="w-3 h-3" />
                      Comparar com anterior
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
