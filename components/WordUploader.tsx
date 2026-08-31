'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WordUploaderProps {
  onUploadComplete: (data: {
    title: string;
    author: string;
    date: string;
    tags: string[];
    excerpt: string;
    content: string;
    footnotes: string;
    references: string;
    images: Array<{ name: string; base64: string }>;
  }) => void;
  onError?: (error: string) => void;
}

export default function WordUploader({ onUploadComplete, onError }: WordUploaderProps) {
  const { success, error: errorToast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback(async (file: File) => {
    // Validate file
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];

    if (!validTypes.includes(file.type) && !file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
      errorToast('Arquivo inválido', 'Por favor, envie apenas arquivos Word (.doc ou .docx)');
      if (onError) onError('Arquivo inválido');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      errorToast('Arquivo muito grande', 'O arquivo deve ter no máximo 10MB');
      if (onError) onError('Arquivo muito grande');
      return;
    }

    setFile(file);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/blog-posts/upload-word', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar arquivo');
      }

      const data = await response.json();
      success('Arquivo processado!', 'Revise os dados antes de salvar');
      onUploadComplete(data);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar arquivo';
      errorToast('Erro no processamento', errorMessage);
      if (onError) onError(errorMessage);
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  }, [onUploadComplete, onError, errorToast, success]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, [processFile]);

  const handleRemoveFile = () => {
    setFile(null);
  };

  return (
    <div className="space-y-4">
      {!file && !isProcessing && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-[6px] p-12 text-center transition-all
            ${isDragging
              ? 'border-brand-500 bg-brand-50 scale-[1.02]'
              : 'border-border-subtle hover:border-brand-400 hover:bg-surface-raised'
            }
          `}
        >
          <input
            type="file"
            id="word-file-input"
            accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="space-y-4">
            <div className="flex justify-center">
              <div className={`
                p-4 rounded-full transition-all
                ${isDragging ? 'bg-brand-100' : 'bg-surface-deep'}
              `}>
                <Upload className={`
                  w-12 h-12 transition-all
                  ${isDragging ? 'text-brand-600' : 'text-ink-muted'}
                `} />
              </div>
            </div>

            <div>
              <p className="text-lg font-semibold text-ink-primary mb-2">
                {isDragging ? 'Solte o arquivo aqui' : 'Arraste seu arquivo Word aqui'}
              </p>
              <p className="text-sm text-ink-muted mb-4">
                ou
              </p>
              <label
                htmlFor="word-file-input"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-[6px] font-bold hover:bg-brand-700 transition-colors cursor-pointer"
              >
                <FileText className="w-5 h-5" />
                Selecionar Arquivo
              </label>
            </div>

            <p className="text-xs text-ink-muted">
              Formatos aceitos: .doc, .docx (máximo 10MB)
            </p>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="border-2 border-brand-200 bg-brand-50 rounded-[6px] p-12 text-center">
          <div className="flex justify-center mb-4">
            <Loader2 className="w-12 h-12 text-brand-600 animate-spin" />
          </div>
          <p className="text-lg font-semibold text-ink-primary mb-2">
            Processando arquivo...
          </p>
          <p className="text-sm text-ink-muted">
            Extraindo conteúdo, notas de rodapé e referências
          </p>
        </div>
      )}

      {file && !isProcessing && (
        <div className="border-2 border-green-200 bg-green-50 rounded-[6px] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-[6px]">
                <FileText className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <p className="font-semibold text-ink-primary">{file.name}</p>
                <p className="text-sm text-ink-muted">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-2 text-red-600 hover:bg-red-100 rounded-[6px] transition-colors"
              title="Remover arquivo"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
