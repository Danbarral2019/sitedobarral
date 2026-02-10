'use client';

import { FileText, ExternalLink } from 'lucide-react';

interface DocumentData {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  url?: string | null;
  category: string;
}

interface LessonDocumentEntry {
  id: string;
  displayOrder: number;
  isRequired: boolean;
  note?: string | null;
  document: DocumentData;
}

interface LessonDocumentsProps {
  documents: LessonDocumentEntry[];
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  pdf: { label: 'PDF', color: 'bg-red-100 text-red-700' },
  link: { label: 'Link', color: 'bg-blue-100 text-blue-700' },
  video: { label: 'Video', color: 'bg-purple-100 text-purple-700' },
  slide: { label: 'Slides', color: 'bg-orange-100 text-orange-700' },
  doc: { label: 'Doc', color: 'bg-gray-100 text-gray-700' },
};

export default function LessonDocuments({ documents }: LessonDocumentsProps) {
  if (documents.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Materiais da Aula</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {documents.map((entry) => {
          const doc = entry.document;
          const badge = TYPE_BADGES[doc.type] || TYPE_BADGES.doc;

          return (
            <a
              key={entry.id}
              href={doc.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-brand-600 transition-colors">
                    {doc.title}
                  </h4>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-400 flex-shrink-0" />
                </div>
                {doc.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-1.5">{doc.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge.color}`}>
                    {badge.label}
                  </span>
                  {entry.isRequired && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                      Obrigatorio
                    </span>
                  )}
                </div>
                {entry.note && (
                  <p className="text-xs text-gray-400 italic mt-1.5">{entry.note}</p>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
