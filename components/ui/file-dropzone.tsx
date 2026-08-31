'use client';

import React, { useCallback, useState } from 'react';
import { Upload, File, X, FileText, Film } from 'lucide-react';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onFileRemove: () => void;
  accept?: string;
  maxSize?: number; // em MB
}

export function FileDropzone({
  onFileSelect,
  selectedFile,
  onFileRemove,
  accept = '.pdf,.doc,.docx,.mp4,.avi,.mov',
  maxSize = 100,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): boolean => {
    // Valida tamanho
    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB > maxSize) {
      setError(`Arquivo muito grande. Máximo: ${maxSize}MB`);
      return false;
    }

    // Valida tipo
    const acceptedTypes = accept.split(',').map(t => t.trim());
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!acceptedTypes.includes(fileExtension)) {
      setError('Tipo de arquivo não suportado');
      return false;
    }

    setError(null);
    return true;
  }, [accept, maxSize]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect, validateFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect, validateFile]);

  const getFileIcon = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['mp4', 'avi', 'mov'].includes(ext || '')) {
      return <Film className="w-8 h-8 text-brand-600" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="w-8 h-8 text-red-600" />;
    }
    return <File className="w-8 h-8 text-brand-600" />;
  };

  return (
    <div className="space-y-3">
      {!selectedFile ? (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-[6px] p-8 text-center transition-all cursor-pointer
            ${isDragging
              ? 'border-brand-500 bg-brand-50 scale-105'
              : 'border-border-subtle hover:border-brand-400 hover:bg-surface-raised'
            }
          `}
        >
          <input
            type="file"
            onChange={handleFileInput}
            accept={accept}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="flex flex-col items-center gap-3">
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center transition-all
              ${isDragging ? 'bg-brand-100' : 'bg-surface-deep'}
            `}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-brand-600' : 'text-ink-muted'}`} />
            </div>

            <div>
              <p className="text-sm font-semibold text-ink-primary">
                {isDragging ? 'Solte o arquivo aqui' : 'Arraste um arquivo ou clique para selecionar'}
              </p>
              <p className="text-xs text-ink-muted mt-1">
                PDF, DOC, DOCX, MP4, AVI, MOV (máx. {maxSize}MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-brand-200 bg-brand-50 rounded-[6px] p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {getFileIcon(selectedFile)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-primary truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-ink-muted">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={onFileRemove}
              className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-[6px] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-[6px] p-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
