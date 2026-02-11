'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Upload, FileText, Loader2, Plus,
  ExternalLink, Calendar, Tag,
  Search, Clock, Eye, EyeOff,
  ChevronLeft, ChevronRight, FolderUp, ChevronDown, ChevronUp,
  Sparkles, RefreshCw
} from 'lucide-react';
import { courses } from '@/data/courses';
import { useToast } from '@/hooks/use-toast';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { Progress } from '@/components/ui/progress';
import { MultiFileDropzone } from '@/components/ui/multi-file-dropzone';
import LeiArticleSelector from '@/components/LeiArticleSelector';

// Dynamic imports
const DocumentAnalyzer = dynamic(() => import('@/components/DocumentAnalyzer'), {
  loading: () => <div className="text-sm text-gray-600">Carregando analisador...</div>,
  ssr: false,
});

type DocumentCategory = 'apostila' | 'acordao' | 'parecer' | 'edital' | 'artigo' | 'orientacao-normativa' | 'enunciados' | 'sumula' | 'outro';

interface AutoImportDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  url: string;
  uploadedAt: string;
  summary?: string | null;
  tcuNumeroAcordao?: string | null;
  reviewedBy?: string | null;
}

interface RecentUpload {
  id: string;
  title: string;
  category: string;
  type: string;
  courseId: string;
  isPublic: boolean;
  uploadedAt: string;
  isCommon: boolean;
}

interface Props {
  autoImports: AutoImportDocument[];
  autoImportsPagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  recentUploads: RecentUpload[];
}

export default function AdicionarDocumentosClient({
  autoImports,
  autoImportsPagination,
  recentUploads,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Upload state
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  const [creationMode, setCreationMode] = useState<'file' | 'manual'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form state
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
  });

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Section collapse state
  const [sectionsCollapsed, setSectionsCollapsed] = useState({
    upload: false,
    autoImports: false,
    recent: true,
  });

  const toggleSection = (section: 'upload' | 'autoImports' | 'recent') => {
    setSectionsCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // URL state updates
  const updateFilter = useCallback((key: string, value: string | null) => {
    const currentParams = new URLSearchParams(Array.from(searchParams.entries()));
    if (value === null || value === '') {
      currentParams.delete(key);
    } else {
      currentParams.set(key, value);
    }
    if (key !== 'page' && key !== 'pageSize') {
      currentParams.set('page', '1');
    }
    router.replace(`${pathname}?${currentParams.toString()}`);
  }, [router, pathname, searchParams]);

  // File handlers
  const handleFileSelect = (file: File) => setSelectedFile(file);
  const handleFileRemove = () => setSelectedFile(null);
  const handleMultipleFilesSelect = (files: File[]) => setMultipleFiles([...multipleFiles, ...files]);
  const handleMultipleFileRemove = (index: number) => setMultipleFiles(multipleFiles.filter((_, i) => i !== index));

  // Filter auto-import docs
  const filteredAutoImports = searchTerm
    ? autoImports.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.tcuNumeroAcordao?.includes(searchTerm)
      )
    : autoImports;

  // Upload handlers
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ title: 'Erro', description: 'Selecione um arquivo', variant: 'error' });
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

      if (formData.category === 'enunciados' || formData.category === 'sumula') {
        if (formData.entityType) formDataToSend.append('entityType', formData.entityType);
        if (formData.enunciadoNumber) formDataToSend.append('enunciadoNumber', formData.enunciadoNumber);
      }

      const response = await new Promise<{ success: boolean; isAllCourses?: boolean; count?: number }>((resolve, reject) => {
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
      });

      const msg = response.isAllCourses
        ? `Documento adicionado a ${response.count} cursos!`
        : `Documento "${formData.title}" enviado com sucesso!`;

      toast({ title: 'Upload realizado!', description: msg, variant: 'success' });
      resetForm();
      router.refresh();
    } catch (error) {
      toast({ title: 'Erro no upload', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'error' });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleBulkUpload = async () => {
    if (multipleFiles.length === 0 || !formData.courseId) {
      toast({ title: 'Erro', description: 'Selecione arquivos e curso', variant: 'error' });
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let totalDocsCreated = 0;

    for (const file of multipleFiles) {
      try {
        const formDataToSend = new FormData();
        formDataToSend.append('file', file);
        formDataToSend.append('courseId', formData.courseId);
        formDataToSend.append('title', file.name.split('.')[0]);
        formDataToSend.append('description', formData.description || '');
        formDataToSend.append('category', formData.category);
        formDataToSend.append('isPublic', formData.isPublic.toString());
        formDataToSend.append('tags', formData.tags);
        formDataToSend.append('leiArticles', JSON.stringify(formData.leiArticles));

        const res = await fetch('/api/admin/upload', { method: 'POST', body: formDataToSend });
        if (res.ok) {
          const data = await res.json();
          successCount++;
          totalDocsCreated += data.count || 1;
        }
      } catch { /* skip */ }
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
  };

  const handleManualCreate = async (e: React.FormEvent) => {
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

      toast({ title: 'Documento criado!', description: `"${formData.title}" criado com sucesso`, variant: 'success' });
      resetForm();
      router.refresh();
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro', variant: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
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
  };

  const getCourseTitle = (courseId: string) => {
    if (!courseId) return 'Comum';
    const course = courses.find(c => c.id === courseId);
    return course?.title || courseId;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Central de Documentos</h1>
          <p className="text-gray-600">Upload de arquivos, criação manual e monitoramento de importações automáticas</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <RefreshCw className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Importados Automaticamente (7d)</p>
                <p className="text-2xl font-bold text-gray-900">{autoImportsPagination.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Upload className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Uploads Recentes (24h)</p>
                <p className="text-2xl font-bold text-gray-900">{recentUploads.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: Upload Form */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
          <button
            onClick={() => toggleSection('upload')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 text-white"
          >
            <div className="flex items-center gap-3">
              <Upload className="w-6 h-6" />
              <span className="text-lg font-bold">Upload de Documentos</span>
            </div>
            {sectionsCollapsed.upload ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>

          {!sectionsCollapsed.upload && (
            <div className="p-6">
              {/* Mode toggles */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setUploadMode('single')}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      uploadMode === 'single' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
                    }`}
                  >
                    <Upload className="w-4 h-4 inline mr-1" /> Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('bulk')}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      uploadMode === 'bulk' ? 'bg-white text-purple-600 shadow' : 'text-gray-600'
                    }`}
                  >
                    <FolderUp className="w-4 h-4 inline mr-1" /> Em Lote
                  </button>
                </div>

                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCreationMode('file')}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      creationMode === 'file' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
                    }`}
                  >
                    <Upload className="w-4 h-4 inline mr-1" /> Com Arquivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMode('manual')}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      creationMode === 'manual' ? 'bg-white text-green-600 shadow' : 'text-gray-600'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline mr-1" /> Manual
                  </button>
                </div>
              </div>

              <form onSubmit={creationMode === 'manual' ? handleManualCreate : (uploadMode === 'single' ? handleUpload : (e) => { e.preventDefault(); handleBulkUpload(); })}>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left column: metadata */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Curso *</label>
                      <select
                        value={formData.courseId}
                        onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                        required
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione um curso</option>
                        <option value="TODOS" className="font-bold">TODOS OS CURSOS ({courses.length} cursos)</option>
                        <option disabled>────────────────────</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>{course.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Titulo *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        placeholder="Ex: Apostila Completa"
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Descricao</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        placeholder="Descricao do documento..."
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Categoria *</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as DocumentCategory })}
                        required
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="apostila">Apostila</option>
                        <option value="acordao">Acordao</option>
                        <option value="parecer">Parecer</option>
                        <option value="orientacao-normativa">Orientacao Normativa (AGU)</option>
                        <option value="enunciados">Enunciados</option>
                        <option value="sumula">Sumula</option>
                        <option value="edital">Edital</option>
                        <option value="artigo">Artigo</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>

                    {/* Entity fields for enunciados */}
                    {(formData.category === 'enunciados' || formData.category === 'sumula') && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">Entidade *</label>
                          <select
                            value={formData.entityType || ''}
                            onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                            required
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                          >
                            <option value="">Selecione a entidade</option>
                            <option value="IBDA">IBDA</option>
                            <option value="INCP">INCP</option>
                            <option value="CJF">CJF</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">Numero</label>
                          <input
                            type="text"
                            value={formData.enunciadoNumber || ''}
                            onChange={(e) => setFormData({ ...formData, enunciadoNumber: e.target.value })}
                            placeholder="Ex: 123"
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isPublic"
                        checked={formData.isPublic}
                        onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label htmlFor="isPublic" className="text-sm font-medium text-gray-900">
                        Documento publico (visivel sem QR Code)
                      </label>
                    </div>
                  </div>

                  {/* Right column: file/manual + articles */}
                  <div className="space-y-4">
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
                      <div className="border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-5 h-5 text-green-600" />
                          <h3 className="font-semibold text-green-900">Criacao Manual</h3>
                        </div>
                        <textarea
                          value={formData.textContent}
                          onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                          required
                          placeholder="Digite o texto completo..."
                          rows={4}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                        />
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Observacoes adicionais..."
                          rows={2}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg mt-2"
                        />
                      </div>
                    )}

                    {uploadMode === 'single' && (
                      <DocumentAnalyzer
                        title={formData.title}
                        description={formData.description}
                        file={selectedFile}
                        currentSelectedArticles={formData.leiArticles}
                        onApplySuggestions={(articles) => setFormData({ ...formData, leiArticles: articles })}
                        disabled={!formData.title}
                      />
                    )}

                    <LeiArticleSelector
                      selectedArticles={formData.leiArticles}
                      onChange={(articles) => setFormData({ ...formData, leiArticles: articles })}
                      maxArticles={5}
                      showPopularArticles={true}
                    />
                  </div>
                </div>

                {isUploading && <Progress value={uploadProgress} className="mt-4" />}

                <button
                  type="submit"
                  disabled={isUploading}
                  className="mt-6 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                  ) : (
                    <><Plus className="w-5 h-5" /> {creationMode === 'manual' ? 'Criar Documento' : 'Fazer Upload'}</>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* SECTION 2: Auto Imports */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
          <button
            onClick={() => toggleSection('autoImports')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6" />
              <span className="text-lg font-bold">Importações Automáticas Recentes (7 dias)</span>
              {autoImportsPagination.total > 0 && (
                <span className="px-2 py-1 bg-white/20 rounded-full text-sm">{autoImportsPagination.total}</span>
              )}
            </div>
            {sectionsCollapsed.autoImports ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>

          {!sectionsCollapsed.autoImports && (
            <div className="p-6">
              {/* Search */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por titulo ou numero..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <select
                  value={searchParams.get('category') || ''}
                  onChange={(e) => updateFilter('category', e.target.value || null)}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="">Todas categorias</option>
                  <option value="acordao">Acórdão TCU</option>
                </select>
              </div>

              {/* List */}
              {filteredAutoImports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCw className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Nenhuma importação automática nos últimos 7 dias</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {filteredAutoImports.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 rounded-lg border-2 border-gray-200 hover:border-indigo-300 transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 truncate">{doc.title}</h4>
                            {doc.tcuNumeroAcordao && (
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-mono flex-shrink-0">
                                {doc.tcuNumeroAcordao}
                              </span>
                            )}
                          </div>
                          {doc.description && <p className="text-sm text-gray-600 truncate mt-1">{doc.description}</p>}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                              <Tag className="w-3 h-3" /> {doc.category}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                            </span>
                            {doc.summary && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Resumo IA
                              </span>
                            )}
                          </div>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded flex-shrink-0"
                          title="Abrir documento"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {autoImportsPagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-600">
                    Página {autoImportsPagination.page} de {autoImportsPagination.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateFilter('page', String(autoImportsPagination.page - 1))}
                      disabled={autoImportsPagination.page <= 1}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateFilter('page', String(autoImportsPagination.page + 1))}
                      disabled={autoImportsPagination.page >= autoImportsPagination.totalPages}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 3: Recent Uploads */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <button
            onClick={() => toggleSection('recent')}
            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-green-500 to-teal-500 text-white"
          >
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6" />
              <span className="text-lg font-bold">Uploads Recentes (24h)</span>
              <span className="px-2 py-1 bg-white/20 rounded-full text-sm">{recentUploads.length}</span>
            </div>
            {sectionsCollapsed.recent ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>

          {!sectionsCollapsed.recent && (
            <div className="p-6">
              {recentUploads.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Nenhum upload nas ultimas 24 horas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentUploads.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          <p className="text-xs text-gray-500">
                            {doc.category} | {doc.isCommon ? 'Comum' : getCourseTitle(doc.courseId)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.isPublic ? (
                          <Eye className="w-4 h-4 text-green-500" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-orange-500" />
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(doc.uploadedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
