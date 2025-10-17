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
        return <Film className="w-8 h-8 text-purple-600" />;
      default:
        return <File className="w-8 h-8 text-blue-600" />;
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
            <p className="text-sm text-gray-600 mt-2">{document.description}</p>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 mt-4">
          {canPreview ? (
            <div className="h-full">
              {document.type === 'pdf' ? (
                <iframe
                  src={document.url}
                  className="w-full h-[600px] border-2 border-gray-200 rounded-lg"
                  title={document.title}
                />
              ) : (
                <video
                  src={document.url}
                  controls
                  className="w-full h-auto max-h-[600px] rounded-lg"
                >
                  Seu navegador não suporta vídeos.
                </video>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-gray-200">
              {getIcon()}
              <p className="text-gray-700 font-medium mt-4 mb-2">Preview não disponível para este tipo de arquivo</p>
              <p className="text-sm text-gray-600 mb-6">
                {document.type === 'doc' ? 'Arquivo Word (.doc/.docx)' : 'Link externo'}
              </p>
              {document.size && (
                <p className="text-sm text-gray-600 mb-6">
                  Tamanho: {(document.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
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

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
          <a
            href={document.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Baixar
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
