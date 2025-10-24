'use client';

import { X, Download, ExternalLink, FileText, Video, Calendar, Tag } from 'lucide-react';

interface DocumentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    title: string;
    description?: string;
    category: string;
    type: string;
    url?: string;
    uploadedAt?: string;
    tags?: string;
  };
  courseTitle: string;
  onDownload: () => void;
  onView?: () => void;
}

export default function DocumentDetailModal({
  isOpen,
  onClose,
  document,
  courseTitle,
  onDownload,
  onView,
}: DocumentDetailModalProps) {
  if (!isOpen) return null;

  // Parse tags se existir
  const parseTags = (tags?: string): string[] => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return [];
    }
  };

  const tags = parseTags(document.tags);

  // Fechar modal ao clicar no backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
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
                <p className="text-blue-100 text-sm">{courseTitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors ml-2"
              aria-label="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Tag className="w-4 h-4" />
                <span className="text-sm font-medium">Categoria</span>
              </div>
              <p className="font-bold text-gray-900 capitalize">{document.category}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Tipo</span>
              </div>
              <p className="font-bold text-gray-900 uppercase">{document.type}</p>
            </div>
          </div>

          {/* Description */}
          {document.description && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Descrição</h3>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <p className="text-gray-800 leading-relaxed">{document.description}</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mb-6">
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

          {/* Upload Date */}
          {document.uploadedAt && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">
                  Enviado em: {new Date(document.uploadedAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {document.type === 'link' && document.url && onView ? (
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onView}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <ExternalLink className="w-5 h-5" />
                Acessar Link Externo
              </a>
            ) : (
              <a
                href={`/api/documents/${document.id}/download`}
                onClick={onDownload}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Download className="w-5 h-5" />
                Download do Arquivo
              </a>
            )}

            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
