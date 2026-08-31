'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { FileText, Film, File, Download, ExternalLink } from 'lucide-react';

interface DocumentPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    title: string;
    type: 'pdf' | 'doc' | 'link' | 'video';
    url: string;
    description?: string;
    size?: number;
  } | null;
}

export function DocumentPreview({ open, onOpenChange, document }: DocumentPreviewProps) {
  if (!document) return null;

  const getIcon = () => {
    switch (document.type) {
      case 'pdf':
        return <FileText className="w-8 h-8 text-red-600" />;
      case 'video':
        return <Film className="w-8 h-8 text-brand-600" />;
      default:
        return <File className="w-8 h-8 text-brand-600" />;
    }
  };

  const canPreview = document.type === 'pdf' || document.type === 'video';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <DialogTitle className="text-xl">{document.title}</DialogTitle>
          </div>
          {document.description && (
            <p className="text-sm text-ink-muted mt-2">{document.description}</p>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 mt-4">
          {canPreview ? (
            <div className="h-full">
              {document.type === 'pdf' ? (
                <iframe
                  src={document.url}
                  className="w-full h-[600px] border-2 border-border-subtle rounded-[6px]"
                  title={document.title}
                />
              ) : (
                <video
                  src={document.url}
                  controls
                  className="w-full h-auto max-h-[600px] rounded-[6px]"
                >
                  Seu navegador não suporta vídeos.
                </video>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-brand-50 rounded-[6px] border-2 border-border-subtle">
              {getIcon()}
              <p className="text-ink-secondary font-medium mt-4 mb-2">Preview não disponível para este tipo de arquivo</p>
              <p className="text-sm text-ink-muted mb-6">
                {document.type === 'doc' ? 'Arquivo Word (.doc/.docx)' : 'Link externo'}
              </p>
              {document.size && (
                <p className="text-sm text-ink-muted mb-6">
                  Tamanho: {(document.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-brand-600 text-white px-6 py-3 rounded-[6px] font-bold hover:from-brand-700 hover:to-brand-700 transition-all flex items-center gap-2 border border-border-subtle"
              >
                {document.type === 'link' ? (
                  <>
                    <ExternalLink className="w-5 h-5" />
                    Abrir Link
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Baixar Arquivo
                  </>
                )}
              </a>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border-subtle">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 border-2 border-border-subtle rounded-[6px] font-medium text-ink-secondary hover:bg-surface-raised transition-colors"
          >
            Fechar
          </button>
          <a
            href={document.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand-600 text-white px-6 py-2 rounded-[6px] font-bold hover:from-brand-700 hover:to-brand-700 transition-all flex items-center gap-2 border border-border-subtle"
          >
            <Download className="w-4 h-4" />
            Baixar
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
