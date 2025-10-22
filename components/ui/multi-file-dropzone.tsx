'use client';

import React, { useCallback, useState } from 'react';
import { Upload, File, X, FileText, Film } from 'lucide-react';

interface MultiFileDropzoneProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  onFileRemove: (index: number) => void;
  accept?: string;
  maxSize?: number; // em MB
  maxFiles?: number;
}

export function MultiFileDropzone({
  onFilesSelect,
  selectedFiles,
  onFileRemove,
  accept = '.pdf,.doc,.docx,.mp4,.avi,.mov',
  maxSize = 100,
  maxFiles = 10,
}: MultiFileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = useCallback((files: FileList): File[] => {
    const validFiles: File[] = [];
    const acceptedTypes = accept.split(',').map(t => t.trim());

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileSizeMB = file.size / 1024 / 1024;
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      // Validar tamanho
      if (fileSizeMB > maxSize) {
        setError(`${file.name}: muito grande (máx. ${maxSize}MB)`);
        continue;
      }

      // Validar tipo
      if (!acceptedTypes.includes(fileExtension)) {
        setError(`${file.name}: tipo não suportado`);
        continue;
      }

      validFiles.push(file);
    }

    // Validar quantidade total
    if (selectedFiles.length + validFiles.length > maxFiles) {
      setError(`Máximo de ${maxFiles} arquivos permitidos`);
      return validFiles.slice(0, maxFiles - selectedFiles.length);
    }

    setError(null);
    return validFiles;
  }, [accept, maxSize, maxFiles, selectedFiles]);

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
      const validFiles = validateFiles(files);
      if (validFiles.length > 0) {
        onFilesSelect(validFiles);
      }
    }
  }, [onFilesSelect, validateFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const validFiles = validateFiles(files);
      if (validFiles.length > 0) {
        onFilesSelect(validFiles);
      }
    }
    // Reset input
    e.target.value = '';
  }, [onFilesSelect, validateFiles]);

  const getFileIcon = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['mp4', 'avi', 'mov'].includes(ext || '')) {
      return <Film className="w-6 h-6 text-purple-600" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="w-6 h-6 text-red-600" />;
    }
    return <File className="w-6 h-6 text-blue-600" />;
  };

  const getTotalSize = () => {
    const total = selectedFiles.reduce((acc, file) => acc + file.size, 0);
    return (total / 1024 / 1024).toFixed(2);
  };

  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-50 scale-105'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
        `}
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          accept={accept}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center gap-3">
          <div className={`
            w-14 h-14 rounded-full flex items-center justify-center transition-all
            ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}
          `}>
            <Upload className={`w-7 h-7 ${isDragging ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">
              {isDragging ? 'Solte os arquivos aqui' : 'Arraste múltiplos arquivos ou clique para selecionar'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              PDF, DOC, DOCX, MP4, AVI, MOV • Máx. {maxSize}MB cada • Até {maxFiles} arquivos
            </p>
          </div>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900">
              {selectedFiles.length} arquivo{selectedFiles.length !== 1 ? 's' : ''} selecionado{selectedFiles.length !== 1 ? 's' : ''}
            </h4>
            <span className="text-xs font-medium text-gray-600">
              Total: {getTotalSize()} MB
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-2">
                {getFileIcon(file)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onFileRemove(index)}
                  className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
