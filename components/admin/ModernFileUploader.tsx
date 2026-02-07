'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon, File, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

// ===========================
// Types
// ===========================

export interface UploadFile {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  r2Key?: string;
  url?: string;
}

export interface ModernFileUploaderProps {
  accept?: string; // ex: ".pdf,.doc,.docx"
  maxSize?: number; // em bytes (default: 50MB)
  maxFiles?: number; // número máximo de arquivos
  onUploadComplete?: (files: UploadFile[]) => void;
  onUploadStart?: (files: File[]) => void;
  uploadEndpoint?: string; // API endpoint para upload
  autoUpload?: boolean; // Upload automático ao selecionar arquivos
}

// ===========================
// Helper Functions
// ===========================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return ImageIcon;
  if (type === 'application/pdf') return FileText;
  return File;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ===========================
// Component
// ===========================

export function ModernFileUploader({
  accept,
  maxSize = 50 * 1024 * 1024, // 50MB
  maxFiles = 10,
  onUploadComplete,
  onUploadStart,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  uploadEndpoint = '/api/admin/upload',
  autoUpload = false,
}: ModernFileUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===========================
  // File Validation
  // ===========================

  const validateFile = useCallback(
    (file: File): { valid: boolean; error?: string } => {
      // Check file size
      if (file.size > maxSize) {
        return {
          valid: false,
          error: `Arquivo muito grande (máx: ${formatFileSize(maxSize)})`,
        };
      }

      // Check file type if accept is specified
      if (accept) {
        const extensions = accept.split(',').map((ext) => ext.trim().toLowerCase());
        const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
        const fileType = file.type.toLowerCase();

        const isValidExt = extensions.some((ext) => fileExt === ext);
        const isValidType = extensions.some((ext) =>
          fileType.includes(ext.replace('.', ''))
        );

        if (!isValidExt && !isValidType) {
          return {
            valid: false,
            error: `Tipo de arquivo não aceito (aceitos: ${accept})`,
          };
        }
      }

      return { valid: true };
    },
    [maxSize, accept]
  );

  // ===========================
  // File Preview
  // ===========================

  const generatePreview = useCallback((file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      } else {
        resolve(undefined);
      }
    });
  }, []);

  // ===========================
  // File Upload (Presigned URL Flow)
  // ===========================

  const uploadFile = useCallback(
    async (uploadFile: UploadFile) => {
      try {
        // Update status to uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
          )
        );

        // Step 1: Request presigned URL from backend
        const presignedResponse = await fetch('/api/admin/upload/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Include cookies for authentication
          body: JSON.stringify({
            fileName: uploadFile.file.name,
            fileSize: uploadFile.file.size,
            fileType: uploadFile.file.type,
          }),
        });

        if (!presignedResponse.ok) {
          throw new Error('Falha ao obter URL de upload');
        }

        const { presignedUrl, r2Key, fileId } = await presignedResponse.json();

        // Step 2: Upload directly to R2 using presigned URL
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setFiles((prev) =>
              prev.map((f) => (f.id === uploadFile.id ? { ...f, progress } : f))
            );
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            try {
              // Step 3: Confirm upload success to backend
              const confirmResponse = await fetch('/api/admin/upload/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({
                  fileId,
                  r2Key,
                  fileName: uploadFile.file.name,
                  fileSize: uploadFile.file.size,
                  fileType: uploadFile.file.type,
                }),
              });

              if (!confirmResponse.ok) {
                throw new Error('Falha ao confirmar upload');
              }

              const { url } = await confirmResponse.json();

              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadFile.id
                    ? {
                        ...f,
                        status: 'completed',
                        progress: 100,
                        r2Key,
                        url,
                      }
                    : f
                )
              );

              // Notify parent of successful upload
              if (onUploadComplete) {
                onUploadComplete([
                  {
                    ...uploadFile,
                    status: 'completed',
                    progress: 100,
                    r2Key,
                    url,
                  },
                ]);
              }
            } catch (confirmError) {
              console.error('Confirmation error:', confirmError);
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uploadFile.id
                    ? {
                        ...f,
                        status: 'error',
                        error: 'Upload concluído, mas confirmação falhou',
                      }
                    : f
                )
              );
            }
          } else {
            throw new Error(`Upload falhou: ${xhr.statusText}`);
          }
        });

        xhr.addEventListener('error', () => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    status: 'error',
                    error: 'Erro ao fazer upload',
                  }
                : f
            )
          );
        });

        // Upload directly to R2
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', uploadFile.file.type);
        xhr.send(uploadFile.file);
      } catch (error) {
        console.error('Upload error:', error);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? {
                  ...f,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Erro ao fazer upload',
                }
              : f
          )
        );
      }
    },
    [onUploadComplete]
  );

  // ===========================
  // File Selection
  // ===========================

  const handleFiles = useCallback(
    async (selectedFiles: FileList | File[]) => {
      const fileArray = Array.from(selectedFiles);

      // Check max files limit
      if (files.length + fileArray.length > maxFiles) {
        alert(`Máximo de ${maxFiles} arquivos permitidos`);
        return;
      }

      // Validate and prepare files
      const newUploadFiles: UploadFile[] = [];

      for (const file of fileArray) {
        const validation = validateFile(file);

        if (!validation.valid) {
          alert(`${file.name}: ${validation.error}`);
          continue;
        }

        const preview = await generatePreview(file);

        newUploadFiles.push({
          id: generateId(),
          file,
          preview,
          progress: 0,
          status: 'pending',
        });
      }

      if (newUploadFiles.length === 0) return;

      // Add files to state
      setFiles((prev) => [...prev, ...newUploadFiles]);

      // Notify parent
      if (onUploadStart) {
        onUploadStart(newUploadFiles.map((f) => f.file));
      }

      // Auto upload if enabled
      if (autoUpload) {
        newUploadFiles.forEach((file) => uploadFile(file));
      }
    },
    [files.length, maxFiles, validateFile, generatePreview, onUploadStart, autoUpload, uploadFile]
  );

  // ===========================
  // Event Handlers
  // ===========================

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const { files: droppedFiles } = e.dataTransfer;
      if (droppedFiles && droppedFiles.length > 0) {
        handleFiles(droppedFiles);
      }
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files: selectedFiles } = e.target;
      if (selectedFiles && selectedFiles.length > 0) {
        handleFiles(selectedFiles);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleUploadAll = useCallback(() => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    pendingFiles.forEach((file) => uploadFile(file));
  }, [files, uploadFile]);

  const handleClearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
  }, []);

  // ===========================
  // Render
  // ===========================

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="w-full space-y-4">
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={maxFiles > 1}
          onChange={handleFileInputChange}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-gray-100 rounded-full">
            <Upload className="w-8 h-8 text-gray-600" />
          </div>

          <div>
            <p className="text-lg font-medium text-gray-700">
              Arraste arquivos aqui ou{' '}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => fileInputRef.current?.click()}
              >
                clique para selecionar
              </button>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {accept && `Tipos aceitos: ${accept}`}
              {accept && maxSize && ' • '}
              {maxSize && `Tamanho máximo: ${formatFileSize(maxSize)}`}
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {files.length} arquivo{files.length > 1 ? 's' : ''}
              {completedCount > 0 && ` • ${completedCount} concluído${completedCount > 1 ? 's' : ''}`}
              {errorCount > 0 && ` • ${errorCount} erro${errorCount > 1 ? 's' : ''}`}
            </div>

            <div className="flex gap-2">
              {!autoUpload && pendingCount > 0 && (
                <button
                  type="button"
                  onClick={handleUploadAll}
                  disabled={uploadingCount > 0}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Fazer Upload ({pendingCount})
                </button>
              )}

              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Limpar Concluídos
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {files.map((uploadFile) => {
              const Icon = getFileIcon(uploadFile.file.type);

              return (
                <div
                  key={uploadFile.id}
                  className="flex items-center gap-3 p-3 bg-white border rounded-lg"
                >
                  {/* Preview or Icon */}
                  <div className="flex-shrink-0">
                    {uploadFile.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={uploadFile.preview}
                        alt={uploadFile.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded">
                        <Icon className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadFile.file.size)}
                    </p>

                    {/* Progress Bar */}
                    {uploadFile.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${uploadFile.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {uploadFile.progress}%
                        </p>
                      </div>
                    )}

                    {/* Error Message */}
                    {uploadFile.status === 'error' && (
                      <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                    )}
                  </div>

                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {uploadFile.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {uploadFile.status === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                    {uploadFile.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    {uploadFile.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(uploadFile.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
