'use client';

import { useEffect, useState } from 'react';
import { Clock, FileText, ExternalLink } from 'lucide-react';

interface RecentDocument {
  id: string;
  title: string;
  category: string;
  courseId: string | null;
  url: string | null;
  lastAccessedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'acordao': 'Acórdão',
  'apostila': 'Apostila',
  'enunciados': 'Enunciado',
  'orientacao-normativa': 'ON AGU',
  'decor': 'DECOR',
  'parecer-vinculante': 'Parecer',
  'manual-tcu': 'Manual TCU',
  'conteudo-programatico': 'Conteúdo',
  'informativo': 'Informativo',
  'bibliografia': 'Bibliografia',
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

interface RecentActivityProps {
  onDocumentClick: (doc: { id: string; title: string; category: string; url?: string }) => void;
}

export default function RecentActivity({ onDocumentClick }: RecentActivityProps) {
  const [documents, setDocuments] = useState<RecentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await fetch('/api/area-restrita/recent-activity');
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.recentDocuments || []);
        }
      } catch {
        // Silently fail — feature is non-critical
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecent();
  }, []);

  if (isLoading || documents.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-ink-secondary">Continue de onde parou</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onDocumentClick({
              id: doc.id,
              title: doc.title,
              category: doc.category,
              url: doc.url || undefined,
            })}
            className="flex-shrink-0 w-56 bg-white border border-border-subtle rounded-[6px] p-3 text-left hover:border-brand-300 hover: transition-all group"
          >
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-primary truncate group-hover:text-brand-700">
                  {doc.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-ink-muted bg-surface-deep px-1.5 py-0.5 rounded">
                    {CATEGORY_LABELS[doc.category] || doc.category}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {formatTimeAgo(doc.lastAccessedAt)}
                  </span>
                </div>
              </div>
              {doc.url && (
                <ExternalLink className="w-3 h-3 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
