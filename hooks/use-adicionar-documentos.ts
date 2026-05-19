'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export type DocumentCategory =
  | 'apostila'
  | 'acordao'
  | 'parecer'
  | 'edital'
  | 'artigo'
  | 'orientacao-normativa'
  | 'enunciados'
  | 'sumula'
  | 'outro';

export type UploadMode = 'single' | 'bulk';
export type CreationMode = 'file' | 'manual';

export interface DocumentFormData {
  courseId: string;
  title: string;
  description: string;
  category: DocumentCategory;
  isPublic: boolean;
  tags: string;
  leiArticles: string[];
  entityType?: string;
  enunciadoNumber?: string;
  textContent?: string;
  notes?: string;
}

const EMPTY_FORM: DocumentFormData = {
  courseId: '',
  title: '',
  description: '',
  category: 'apostila',
  isPublic: false,
  tags: '',
  leiArticles: [],
};

export function useAdicionarDocumentos() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [uploadMode, setUploadMode] = useState<UploadMode>('single');
  const [creationMode, setCreationMode] = useState<CreationMode>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState<DocumentFormData>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');

  const [sectionsCollapsed, setSectionsCollapsed] = useState({
    upload: false,
    autoImports: false,
    recent: true,
  });

  const toggleSection = useCallback((section: 'upload' | 'autoImports' | 'recent') => {
    setSectionsCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
      if (key !== 'page' && key !== 'pageSize') params.set('page', '1');
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleFileSelect = useCallback((file: File) => setSelectedFile(file), []);
  const handleFileRemove = useCallback(() => setSelectedFile(null), []);
  const handleMultipleFilesSelect = useCallback(
    (files: File[]) => setMultipleFiles((prev) => [...prev, ...files]),
    [],
  );
  const handleMultipleFileRemove = useCallback(
    (index: number) => setMultipleFiles((prev) => prev.filter((_, i) => i !== index)),
    [],
  );

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM);
    setSelectedFile(null);
  }, []);

  const buildUploadFormData = useCallback(
    (file: File, overrides: Partial<DocumentFormData> = {}): FormData => {
      const data = new FormData();
      const merged = { ...formData, ...overrides };
      data.append('file', file);
      data.append('courseId', merged.courseId);
      data.append('title', merged.title);
      data.append('description', merged.description);
      data.append('category', merged.category);
      data.append('isPublic', merged.isPublic.toString());
      data.append('tags', merged.tags);
      data.append('leiArticles', JSON.stringify(merged.leiArticles));
      if (merged.category === 'enunciados' || merged.category === 'sumula') {
        if (merged.entityType) data.append('entityType', merged.entityType);
        if (merged.enunciadoNumber) data.append('enunciadoNumber', merged.enunciadoNumber);
      }
      return data;
    },
    [formData],
  );

  const handleUpload = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedFile) {
        toast({ title: 'Erro', description: 'Selecione um arquivo', variant: 'error' });
        return;
      }
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const formDataToSend = buildUploadFormData(selectedFile);
        const response = await new Promise<{ success: boolean; isAllCourses?: boolean; count?: number }>(
          (resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) setUploadProgress((event.loaded / event.total) * 100);
            });
            xhr.addEventListener('load', () => {
              if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
              else reject(new Error(JSON.parse(xhr.responseText).error || 'Erro no upload'));
            });
            xhr.addEventListener('error', () => reject(new Error('Erro de rede')));
            xhr.open('POST', '/api/admin/upload');
            xhr.send(formDataToSend);
          },
        );
        const msg = response.isAllCourses
          ? `Documento adicionado a ${response.count} cursos!`
          : `Documento "${formData.title}" enviado com sucesso!`;
        toast({ title: 'Upload realizado!', description: msg, variant: 'success' });
        resetForm();
        router.refresh();
      } catch (error) {
        toast({
          title: 'Erro no upload',
          description: error instanceof Error ? error.message : 'Erro desconhecido',
          variant: 'error',
        });
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [selectedFile, buildUploadFormData, formData.title, router, toast, resetForm],
  );

  const handleBulkUpload = useCallback(async () => {
    if (multipleFiles.length === 0 || !formData.courseId) {
      toast({ title: 'Erro', description: 'Selecione arquivos e curso', variant: 'error' });
      return;
    }
    setIsUploading(true);
    let successCount = 0;
    let totalDocsCreated = 0;
    for (const file of multipleFiles) {
      try {
        const formDataToSend = buildUploadFormData(file, { title: file.name.split('.')[0] });
        const res = await fetch('/api/admin/upload', { method: 'POST', body: formDataToSend });
        if (res.ok) {
          const data = await res.json();
          successCount++;
          totalDocsCreated += data.count || 1;
        }
      } catch {
        // silently fail
      }
    }
    setIsUploading(false);
    setMultipleFiles([]);
    if (successCount > 0) {
      toast({
        title: `${successCount} arquivo(s) enviado(s)!`,
        description: `${totalDocsCreated} documento(s) criado(s)`,
        variant: 'success',
      });
      router.refresh();
    }
  }, [multipleFiles, formData.courseId, buildUploadFormData, router, toast]);

  const handleManualCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title || !formData.courseId) {
        toast({ title: 'Erro', description: 'Título e Curso são obrigatórios', variant: 'error' });
        return;
      }
      setIsUploading(true);
      try {
        const res = await fetch('/api/admin/documents/create-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar');
        toast({
          title: 'Documento criado!',
          description: `"${formData.title}" criado com sucesso`,
          variant: 'success',
        });
        resetForm();
        router.refresh();
      } catch (error) {
        toast({
          title: 'Erro',
          description: error instanceof Error ? error.message : 'Erro',
          variant: 'error',
        });
      } finally {
        setIsUploading(false);
      }
    },
    [formData, router, toast, resetForm],
  );

  return {
    // Upload state
    uploadMode,
    setUploadMode,
    creationMode,
    setCreationMode,
    selectedFile,
    multipleFiles,
    isUploading,
    uploadProgress,
    handleFileSelect,
    handleFileRemove,
    handleMultipleFilesSelect,
    handleMultipleFileRemove,

    // Form
    formData,
    setFormData,

    // Section UI
    sectionsCollapsed,
    toggleSection,

    // Search/filters
    searchTerm,
    setSearchTerm,
    updateFilter,
    searchParams,

    // Actions
    handleUpload,
    handleBulkUpload,
    handleManualCreate,
  };
}
