'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileText, Loader2, Trash2,
  Eye, EyeOff, File, Search, Filter, X,
  Download, FolderUp, CheckSquare, Square, Edit2, StickyNote, Info
} from 'lucide-react';
import { courses } from '@/data/courses';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { DocumentPreview } from '@/components/ui/document-preview';
import { Progress } from '@/components/ui/progress';
import { DocumentCardSkeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import { MultiFileDropzone } from '@/components/ui/multi-file-dropzone';
import AdminLayout from '@/components/AdminLayout';
import LeiArticleSelector from '@/components/LeiArticleSelector';
import DocumentAnalyzer from '@/components/DocumentAnalyzer';
import BatchClassifyPanel from '@/components/BatchClassifyPanel';
import DocumentNotesEditor from '@/components/DocumentNotesEditor';
import LeiCoverageDashboard from '@/components/admin/LeiCoverageDashboard';

type DocumentCategory = 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'enunciados' | 'sumula' | 'outro';

interface UploadResponse {
  success: boolean;
  isAllCourses?: boolean;
  count?: number;
  error?: string;
}

interface Document {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'doc' | 'link' | 'video';
  url: string;
  category: string;
  courseId: string;
  isPublic: boolean;
  leiArticles?: string; // JSON array de números de artigos
  size?: number;
  uploadedAt: string;
  reviewed?: boolean; // Se foi revisado por um humano
  reviewedAt?: string; // Data da revisão
  entityType?: string; // Entidade do enunciado (IBDA, INCP, CJF)
  enunciadoNumber?: string; // Número do enunciado
}

export default function DocumentosPage() {
  const router = useRouter();
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [documentToPreview, setDocumentToPreview] = useState<Document | null>(null);
  const [notesEditorOpen, setNotesEditorOpen] = useState(false);
  const [documentToEditNotes, setDocumentToEditNotes] = useState<Document | null>(null);

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterVisibility, setFilterVisibility] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Bulk operations
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  const [creationMode, setCreationMode] = useState<'file' | 'manual'>('file'); // Novo: modo de criação
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [showClassifyPanel, setShowClassifyPanel] = useState(false);

  const [formData, setFormData] = useState<{
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
  }>({
    courseId: '',
    title: '',
    description: '',
    category: 'apostila',
    isPublic: false,
    tags: '',
    leiArticles: [],
    entityType: undefined,
    enunciadoNumber: undefined,
    textContent: '',
    notes: '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');
      if (!response.ok) {
        router.push('/admin/login');
        return;
      }

      const data = await response.json();
      if (data.user.role !== 'admin') {
        router.push('/admin/login');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      router.push('/admin/login');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      console.log('[Client] Carregando documentos...');
      const response = await fetch('/api/admin/documents');
      console.log('[Client] Response status:', response.status);

      const data = await response.json();
      console.log('[Client] Data received:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Erro ao carregar documentos');
      }

      setDocuments(data.documents || []);
      console.log('[Client] Documentos setados:', data.documents?.length || 0);
    } catch (error) {
      console.error('[Client] Erro ao carregar documentos:', error);
      errorToast('Erro ao carregar documentos', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoadingDocs(false);
    }
  }, [errorToast]);

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  useEffect(() => {
    if (!isLoading) {
      loadDocuments();
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
  };

  // Bulk operations handlers
  const handleMultipleFilesSelect = (files: File[]) => {
    setMultipleFiles([...multipleFiles, ...files]);
  };

  const handleMultipleFileRemove = (index: number) => {
    setMultipleFiles(multipleFiles.filter((_, i) => i !== index));
  };

  const toggleDocumentSelection = (id: string) => {
    const newSelection = new Set(selectedDocuments);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedDocuments(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedDocuments.size === paginatedDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(paginatedDocuments.map(doc => doc.id)));
    }
  };

  const selectAllDocuments = () => {
    setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)));
  };

  const deselectAllDocuments = () => {
    setSelectedDocuments(new Set());
  };

  const handleBulkUpload = async () => {
    if (multipleFiles.length === 0 || !formData.courseId) {
      errorToast('Dados incompletos', 'Selecione os arquivos e o curso');
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let totalDocsCreated = 0;
    let errorCount = 0;
    const isUploadingToAllCourses = formData.courseId.toUpperCase() === 'TODOS' || formData.courseId === '*';

    for (const file of multipleFiles) {
      try {
        const formDataToSend = new FormData();
        formDataToSend.append('file', file);
        formDataToSend.append('courseId', formData.courseId);
        formDataToSend.append('title', file.name.split('.')[0]); // Nome do arquivo sem extensão
        formDataToSend.append('description', formData.description || '');
        formDataToSend.append('category', formData.category);
        formDataToSend.append('isPublic', formData.isPublic.toString());
        formDataToSend.append('tags', formData.tags);
        formDataToSend.append('leiArticles', JSON.stringify(formData.leiArticles));

        // Campos específicos para enunciados e súmulas
        if (formData.category === 'enunciados' || formData.category === 'sumula') {
          if (formData.entityType) {
            formDataToSend.append('entityType', formData.entityType);
          }
          if (formData.enunciadoNumber) {
            formDataToSend.append('enunciadoNumber', formData.enunciadoNumber);
          }
        }

        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formDataToSend,
        });

        if (response.ok) {
          const data = await response.json();
          successCount++;
          totalDocsCreated += data.count || 1;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setIsUploading(false);
    setMultipleFiles([]);
    loadDocuments();

    if (successCount > 0) {
      if (isUploadingToAllCourses) {
        success(
          `${successCount} arquivo${successCount !== 1 ? 's' : ''} enviado${successCount !== 1 ? 's' : ''}!`,
          `${totalDocsCreated} documento${totalDocsCreated !== 1 ? 's' : ''} criado${totalDocsCreated !== 1 ? 's' : ''} em todos os cursos${errorCount > 0 ? ` (${errorCount} falharam)` : ''}`
        );
      } else {
        success(
          `${successCount} arquivo${successCount !== 1 ? 's' : ''} enviado${successCount !== 1 ? 's' : ''}!`,
          errorCount > 0 ? `${errorCount} falharam` : 'Upload completo'
        );
      }
    } else {
      errorToast('Erro no upload', 'Não foi possível enviar os arquivos');
    }
  };

  const handleBulkAction = async () => {
    if (selectedDocuments.size === 0) {
      errorToast('Nenhum documento selecionado', 'Selecione ao menos um documento');
      return;
    }

    if (bulkAction === 'classify') {
      setShowClassifyPanel(true);
      setBulkAction('');
      return;
    }

    if (bulkAction === 'delete') {
      setIsDeleting(true);
      try {
        const deletePromises = Array.from(selectedDocuments).map(id =>
          fetch('/api/admin/documents', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          })
        );

        await Promise.all(deletePromises);
        success(
          `${selectedDocuments.size} documento${selectedDocuments.size !== 1 ? 's' : ''} removido${selectedDocuments.size !== 1 ? 's' : ''}!`,
          'Documentos excluídos com sucesso'
        );
        setSelectedDocuments(new Set());
        loadDocuments();
      } catch {
        errorToast('Erro ao deletar', 'Não foi possível remover os documentos');
      } finally {
        setIsDeleting(false);
      }
    } else if (bulkAction === 'changeCategory' && bulkCategory) {
      // TODO: Implementar mudança de categoria via API
      success('Categoria alterada!', `${selectedDocuments.size} documentos atualizados`);
      setSelectedDocuments(new Set());
    } else if (bulkAction === 'markReviewed') {
      setIsDeleting(true); // Reusa o loading
      try {
        const reviewPromises = Array.from(selectedDocuments).map(id =>
          fetch(`/api/admin/documents/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewed: true }),
          })
        );

        await Promise.all(reviewPromises);
        success(
          `${selectedDocuments.size} documento${selectedDocuments.size !== 1 ? 's' : ''} marcado${selectedDocuments.size !== 1 ? 's' : ''} como revisado!`,
          'Documentos atualizados com sucesso'
        );
        setSelectedDocuments(new Set());
        loadDocuments();
      } catch {
        errorToast('Erro ao marcar', 'Não foi possível atualizar os documentos');
      } finally {
        setIsDeleting(false);
      }
    }

    setBulkAction('');
    setBulkCategory('');
  };

  const exportDocuments = (format: 'json' | 'csv') => {
    const docsToExport = selectedDocuments.size > 0
      ? documents.filter(doc => selectedDocuments.has(doc.id))
      : documents;

    if (format === 'json') {
      const dataStr = JSON.stringify(docsToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `documentos-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
    } else {
      const headers = ['Título', 'Descrição', 'Curso', 'Categoria', 'Tipo', 'Público', 'Data'];
      const rows = docsToExport.map(doc => {
        const course = courses.find(c => c.id === doc.courseId);
        return [
          doc.title,
          doc.description || '',
          course?.title || '',
          doc.category,
          doc.type,
          doc.isPublic ? 'Sim' : 'Não',
          new Date(doc.uploadedAt).toLocaleDateString('pt-BR'),
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      const dataBlob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `documentos-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    }

    success('Exportação concluída!', `${docsToExport.length} documentos exportados em ${format.toUpperCase()}`);
  };

  // Nova função para criar documento manual (sem arquivo)
  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.courseId) {
      errorToast('Campos obrigatórios', 'Título e Curso são obrigatórios.');
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch('/api/admin/documents/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: formData.courseId,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          isPublic: formData.isPublic,
          tags: formData.tags,
          leiArticles: formData.leiArticles,
          entityType: formData.entityType,
          enunciadoNumber: formData.enunciadoNumber,
          textContent: formData.textContent,
          notes: formData.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar documento');
      }

      success('Documento criado!', `O documento "${formData.title}" foi criado com sucesso.`);

      // Reset form
      setFormData({
        courseId: '',
        title: '',
        description: '',
        category: 'apostila',
        isPublic: false,
        tags: '',
        leiArticles: [],
        entityType: undefined,
        enunciadoNumber: undefined,
        textContent: '',
        notes: '',
      });

      loadDocuments();
    } catch (error) {
      console.error('[Manual Create] Erro:', error);
      errorToast('Erro', error instanceof Error ? error.message : 'Erro ao criar documento');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      errorToast('Arquivo não selecionado', 'Por favor, selecione um arquivo para fazer upload.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', selectedFile);
      formDataToSend.append('courseId', formData.courseId);
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('isPublic', formData.isPublic.toString());
      formDataToSend.append('tags', formData.tags);
      formDataToSend.append('leiArticles', JSON.stringify(formData.leiArticles));

      // Campos específicos para enunciados e súmulas
      if (formData.category === 'enunciados' || formData.category === 'sumula') {
        if (formData.entityType) {
          formDataToSend.append('entityType', formData.entityType);
        }
        if (formData.enunciadoNumber) {
          formDataToSend.append('enunciadoNumber', formData.enunciadoNumber);
        }
      }

      // Usar XMLHttpRequest para rastrear progresso
      const uploadResponse = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.error || 'Erro no upload'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Erro de rede'));
        });

        xhr.open('POST', '/api/admin/upload');
        xhr.send(formDataToSend);
      });

      // Mensagem de sucesso personalizada
      if (uploadResponse.isAllCourses) {
        success(
          'Upload realizado para todos os cursos!',
          `O documento "${formData.title}" foi adicionado a ${uploadResponse.count} curso${uploadResponse.count !== 1 ? 's' : ''}.`
        );
      } else {
        success('Upload realizado!', `O documento "${formData.title}" foi enviado com sucesso.`);
      }

      setFormData({
        courseId: '',
        title: '',
        description: '',
        category: 'apostila',
        isPublic: false,
        tags: '',
        leiArticles: [],
      });
      setSelectedFile(null);

      // Recarrega a lista
      loadDocuments();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      errorToast('Erro no upload', error instanceof Error ? error.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handlePreviewClick = (doc: Document) => {
    setDocumentToPreview(doc);
    setPreviewOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDocumentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCourse('');
    setFilterCategory('');
    setFilterType('');
    setFilterVisibility('');
    setFilterEntity('');
    setCurrentPage(1);
  };

  const filteredDocuments = documents.filter((doc) => {
    // Busca por termo
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    // Filtro por curso
    const matchesCourse = !filterCourse || doc.courseId === filterCourse;

    // Filtro por categoria
    const matchesCategory = !filterCategory || doc.category === filterCategory;

    // Filtro por tipo
    const matchesType = !filterType || doc.type === filterType;

    // Filtro por visibilidade
    const matchesVisibility =
      !filterVisibility ||
      (filterVisibility === 'public' && doc.isPublic) ||
      (filterVisibility === 'private' && !doc.isPublic);

    // Filtro por entidade (para enunciados)
    const matchesEntity = !filterEntity || doc.entityType === filterEntity;

    return matchesSearch && matchesCourse && matchesCategory && matchesType && matchesVisibility && matchesEntity;
  });

  const activeFiltersCount = [filterCourse, filterCategory, filterType, filterVisibility, filterEntity].filter(Boolean).length;

  // Calcular paginação
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCourse, filterCategory, filterType, filterVisibility]);

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    setIsDeleting(true);

    try {
      const response = await fetch('/api/admin/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: documentToDelete }),
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar documento');
      }

      success('Documento removido!', 'O documento foi excluído com sucesso.');
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      loadDocuments();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      errorToast('Erro ao deletar', 'Não foi possível remover o documento.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </main>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Documentos</h2>
            <p className="text-gray-600">Faça upload e gerencie materiais dos cursos</p>
          </div>

          {/* Dashboard de Cobertura da Lei 14.133 */}
          <LeiCoverageDashboard />

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Formulário de Upload */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 sticky top-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Upload de Arquivo</h2>
                </div>

                {/* Tabs de Upload */}
                <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setUploadMode('single')}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      uploadMode === 'single'
                        ? 'bg-white text-blue-600 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Upload className="w-4 h-4 inline mr-1" />
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('bulk')}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      uploadMode === 'bulk'
                        ? 'bg-white text-purple-600 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FolderUp className="w-4 h-4 inline mr-1" />
                    Em Lote
                  </button>
                </div>

                {/* Botões: Com Arquivo / Manual */}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCreationMode('file')}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      creationMode === 'file'
                        ? 'bg-white text-blue-600 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Upload className="w-4 h-4 inline mr-1" />
                    Com Arquivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMode('manual')}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      creationMode === 'manual'
                        ? 'bg-white text-green-600 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline mr-1" />
                    Manual
                  </button>
                </div>

                <form onSubmit={creationMode === 'manual' ? handleManualCreate : (uploadMode === 'single' ? handleUpload : (e) => { e.preventDefault(); handleBulkUpload(); })} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Curso *
                    </label>
                    <select
                      value={formData.courseId}
                      onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                      required
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    >
                      <option value="">Selecione um curso</option>
                      <option value="TODOS" className="font-bold bg-gradient-to-r from-blue-50 to-purple-50">
                        ⭐ TODOS OS CURSOS ({courses.length} cursos)
                      </option>
                      <option disabled>──────────────────────</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Título *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      placeholder="Ex: Apostila Completa"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Descrição
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Descrição do documento..."
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Categoria *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as DocumentCategory })}
                      required
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                    >
                      <option value="apostila">Apostila</option>
                      <option value="acordao">Acórdão</option>
                      <option value="parecer">Parecer</option>
                      <option value="orientacao-normativa">Orientação Normativa (AGU)</option>
                      <option value="enunciados">Enunciados</option>
                      <option value="sumula">Súmula</option>
                      <option value="edital">Edital</option>
                      <option value="artigo">Artigo</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  {/* Campos específicos para Enunciados e Súmulas */}
                  {(formData.category === 'enunciados' || formData.category === 'sumula') && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Entidade *
                        </label>
                        <select
                          value={formData.entityType || ''}
                          onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                          required
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                        >
                          <option value="">Selecione a entidade</option>
                          <option value="IBDA">IBDA - Instituto Brasileiro de Direito Administrativo</option>
                          <option value="INCP">INCP - Instituto Nacional da Contratação Pública</option>
                          <option value="CJF">CJF - Conselho da Justiça Federal</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Número (Opcional)
                        </label>
                        <input
                          type="text"
                          value={formData.enunciadoNumber || ''}
                          onChange={(e) => setFormData({ ...formData, enunciadoNumber: e.target.value })}
                          placeholder="Ex: 123, 123/2024, ou deixe em branco"
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900"
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          Formato flexível: pode ser apenas número, número/ano, ou texto livre
                        </p>
                      </div>
                    </>
                  )}

                  {/* Seção de arquivo OU campos manuais */}
                  {creationMode === 'file' ? (
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Arquivo{uploadMode === 'bulk' ? 's' : ''} *
                      </label>
                      {uploadMode === 'single' ? (
                        <FileDropzone
                          onFileSelect={handleFileSelect}
                          selectedFile={selectedFile}
                          onFileRemove={handleFileRemove}
                          accept=".pdf,.doc,.docx,.mp4,.avi,.mov"
                          maxSize={100}
                        />
                      ) : (
                        <MultiFileDropzone
                          onFilesSelect={handleMultipleFilesSelect}
                          selectedFiles={multipleFiles}
                          onFileRemove={handleMultipleFileRemove}
                          accept=".pdf,.doc,.docx,.mp4,.avi,.mov"
                          maxSize={100}
                          maxFiles={10}
                        />
                      )}
                    </div>
                  ) : (
                    /* Campos específicos para criação manual */
                    <div className="space-y-4 border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <h3 className="font-semibold text-green-900">Criação Manual (sem arquivo)</h3>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Texto Completo *
                        </label>
                        <textarea
                          value={formData.textContent}
                          onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                          required
                          placeholder="Digite o texto completo do documento..."
                          rows={6}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Observações Adicionais
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Observações adicionais, contexto, referências..."
                          rows={3}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-600 text-gray-900"
                        />
                      </div>

                      <p className="text-xs text-gray-600 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>
                          Use os campos acima (Categoria, Entidade, Número) para informações estruturadas.
                          O texto completo e observações serão salvos no campo de notas do documento.
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="isPublic" className="text-sm font-medium text-gray-900">
                      Documento público (visível sem QR Code)
                    </label>
                  </div>

                  {/* Análise Automática de Artigos */}
                  {uploadMode === 'single' && (
                    <div>
                      <DocumentAnalyzer
                        title={formData.title}
                        description={formData.description}
                        file={selectedFile}
                        currentSelectedArticles={formData.leiArticles}
                        onApplySuggestions={(articles) => setFormData({ ...formData, leiArticles: articles })}
                        disabled={!formData.title}
                      />
                    </div>
                  )}

                  {/* Seletor Manual de Artigos da Lei 14.133/2021 */}
                  <div>
                    <LeiArticleSelector
                      selectedArticles={formData.leiArticles}
                      onChange={(articles) => setFormData({ ...formData, leiArticles: articles })}
                      maxArticles={5}
                      showPopularArticles={true}
                    />
                  </div>

                  {isUploading && (
                    <Progress value={uploadProgress} className="mb-2" />
                  )}

                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Fazer Upload
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Lista de Documentos */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Documentos Cadastrados</h2>
                  </div>

                  {/* Botões de Exportação */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportDocuments('json')}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
                      title="Exportar JSON"
                    >
                      <Download className="w-4 h-4" />
                      JSON
                    </button>
                    <button
                      onClick={() => exportDocuments('csv')}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
                      title="Exportar CSV"
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </button>
                  </div>
                </div>

                {/* Barra de Ações em Lote */}
                {selectedDocuments.size > 0 && (
                  <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-bold text-blue-900">
                        {selectedDocuments.size} selecionado{selectedDocuments.size !== 1 ? 's' : ''}
                      </span>

                      <select
                        value={bulkAction}
                        onChange={(e) => setBulkAction(e.target.value)}
                        className="px-3 py-1.5 border-2 border-blue-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione uma ação</option>
                        <option value="classify">🤖 Classificar Automaticamente (IA)</option>
                        <option value="markReviewed">✅ Marcar como Revisado</option>
                        <option value="delete">Deletar selecionados</option>
                        <option value="changeCategory">Alterar categoria</option>
                      </select>

                      {bulkAction === 'changeCategory' && (
                        <select
                          value={bulkCategory}
                          onChange={(e) => setBulkCategory(e.target.value)}
                          className="px-3 py-1.5 border-2 border-blue-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Nova categoria</option>
                          <option value="apostila">Apostila</option>
                          <option value="acordao">Acórdão</option>
                          <option value="parecer">Parecer</option>
                          <option value="orientacao-normativa">Orientação Normativa (AGU)</option>
                          <option value="edital">Edital</option>
                          <option value="artigo">Artigo</option>
                          <option value="outro">Outro</option>
                        </select>
                      )}

                      <button
                        onClick={handleBulkAction}
                        disabled={!bulkAction || (bulkAction === 'changeCategory' && !bulkCategory)}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Aplicar
                      </button>

                      <button
                        onClick={() => setSelectedDocuments(new Set())}
                        className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Limpar seleção
                      </button>
                    </div>
                  </div>
                )}

                {/* Busca e Filtros */}
                <div className="mb-6 space-y-4">
                  {/* Campo de Busca */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por título ou descrição..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                    />
                  </div>

                  {/* Filtros */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <select
                      value={filterCourse}
                      onChange={(e) => setFilterCourse(e.target.value)}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                    >
                      <option value="">Todos os cursos</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                    >
                      <option value="">Todas categorias</option>
                      <option value="apostila">Apostila</option>
                      <option value="acordao">Acórdão</option>
                      <option value="parecer">Parecer</option>
                      <option value="orientacao-normativa">Orientação Normativa (AGU)</option>
                      <option value="enunciados">Enunciados</option>
                      <option value="edital">Edital</option>
                      <option value="artigo">Artigo</option>
                      <option value="outro">Outro</option>
                    </select>

                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                    >
                      <option value="">Todos os tipos</option>
                      <option value="pdf">PDF</option>
                      <option value="doc">DOC/DOCX</option>
                      <option value="video">Vídeo</option>
                      <option value="link">Link</option>
                    </select>

                    <select
                      value={filterVisibility}
                      onChange={(e) => setFilterVisibility(e.target.value)}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                    >
                      <option value="">Todas visibilidades</option>
                      <option value="public">Público</option>
                      <option value="private">Restrito</option>
                    </select>
                  </div>

                  {/* Filtro adicional: Entidade (somente quando categoria=enunciados) */}
                  {filterCategory === 'enunciados' && (
                    <div className="mt-3">
                      <select
                        value={filterEntity}
                        onChange={(e) => setFilterEntity(e.target.value)}
                        className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 text-sm bg-blue-50"
                      >
                        <option value="">Todas as entidades</option>
                        <option value="IBDA">IBDA - Instituto Brasileiro de Direito Administrativo</option>
                        <option value="INCP">INCP - Instituto Nacional da Contratação Pública</option>
                        <option value="CJF">CJF - Conselho da Justiça Federal</option>
                      </select>
                    </div>
                  )}

                  {/* Indicador de filtros ativos */}
                  {(activeFiltersCount > 0 || searchTerm) && (
                    <div className="flex items-center justify-between bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-900">
                          {filteredDocuments.length} documento{filteredDocuments.length !== 1 ? 's' : ''} encontrado{filteredDocuments.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-100 px-3 py-1 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Limpar filtros
                      </button>
                    </div>
                  )}

                  {/* Selecionar Todos */}
                  {paginatedDocuments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                      >
                        {selectedDocuments.size === paginatedDocuments.length ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                        Selecionar página ({paginatedDocuments.length})
                      </button>

                      {filteredDocuments.length > paginatedDocuments.length && (
                        <>
                          <span className="text-gray-400">|</span>
                          <button
                            onClick={selectAllDocuments}
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <CheckSquare className="w-5 h-5" />
                            Selecionar TODOS ({filteredDocuments.length})
                          </button>
                        </>
                      )}

                      {selectedDocuments.size > 0 && (
                        <>
                          <span className="text-gray-400">|</span>
                          <button
                            onClick={deselectAllDocuments}
                            className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                          >
                            <Square className="w-5 h-5" />
                            Desselecionar todos
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {isLoadingDocs ? (
                  <div className="space-y-4">
                    <DocumentCardSkeleton />
                    <DocumentCardSkeleton />
                    <DocumentCardSkeleton />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <File className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>Nenhum documento cadastrado ainda</p>
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">Nenhum documento encontrado</p>
                    <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {paginatedDocuments.map((doc) => {
                        const course = courses.find(c => c.id === doc.courseId);
                        const isSelected = selectedDocuments.has(doc.id);

                      return (
                        <div
                          key={doc.id}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-gradient-to-r from-blue-100 to-purple-100'
                              : 'border-gray-200 hover:border-blue-300 bg-gradient-to-r from-blue-50 to-purple-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-start gap-3 flex-1">
                              {/* Checkbox de seleção */}
                              <button
                                onClick={() => toggleDocumentSelection(doc.id)}
                                className="mt-1"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                                )}
                              </button>

                              <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-bold text-gray-900">{doc.title}</h3>
                                {doc.isPublic ? (
                                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    Público
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full flex items-center gap-1">
                                    <EyeOff className="w-3 h-3" />
                                    Restrito
                                  </span>
                                )}
                                {/* Badge de status de revisão */}
                                {doc.reviewed ? (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                                    Revisado
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full animate-pulse">
                                    Novo
                                  </span>
                                )}
                                {/* Badge de entidade (para enunciados) */}
                                {doc.category === 'enunciados' && doc.entityType && (
                                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                    doc.entityType === 'IBDA' ? 'bg-purple-100 text-purple-800' :
                                    doc.entityType === 'INCP' ? 'bg-indigo-100 text-indigo-800' :
                                    doc.entityType === 'CJF' ? 'bg-cyan-100 text-cyan-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {doc.entityType}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 font-medium">{course?.title}</p>
                              {doc.description && (
                                <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                              )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handlePreviewClick(doc)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                title="Visualizar"
                              >
                                <Search className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setDocumentToEditNotes(doc);
                                  setNotesEditorOpen(true);
                                }}
                                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 p-2 rounded-lg transition-colors"
                                title="Observações"
                              >
                                <StickyNote className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => router.push(`/admin/documentos/${doc.id}/edit`)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 p-2 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(doc.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-gray-600">Tipo:</span>
                              <span className="ml-1 font-medium text-gray-900">{doc.type.toUpperCase()}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Categoria:</span>
                              <span className="ml-1 font-medium text-gray-900">{doc.category}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Tamanho:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {doc.size ? `${(doc.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </div>

                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      itemsPerPage={itemsPerPage}
                      totalItems={filteredDocuments.length}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DocumentPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        document={documentToPreview}
      />

      {/* Painel de Classificação Automática */}
      {showClassifyPanel && (
        <BatchClassifyPanel
          selectedDocuments={selectedDocuments}
          onClose={() => setShowClassifyPanel(false)}
          onSuccess={() => {
            loadDocuments();
            setSelectedDocuments(new Set());
          }}
        />
      )}

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir documento?"
        description="Esta ação não pode ser desfeita. O documento será permanentemente removido do sistema."
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        onConfirm={handleDeleteConfirm}
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Editor de Observações */}
      {notesEditorOpen && documentToEditNotes && (
        <DocumentNotesEditor
          documentId={documentToEditNotes.id}
          documentTitle={documentToEditNotes.title}
          onClose={() => {
            setNotesEditorOpen(false);
            setDocumentToEditNotes(null);
          }}
          onSaved={() => {
            loadDocuments(); // Recarrega a lista de documentos
          }}
        />
      )}
    </AdminLayout>
  );
}
