'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  FileText, Loader2, Search, Filter, X, Download,
  CheckSquare, Square, Plus, RefreshCw,
  AlertTriangle, CheckCircle, AlertCircle
} from 'lucide-react';
import { courses } from '@/data/courses';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { DocumentPreview } from '@/components/ui/document-preview';
import { Pagination } from '@/components/ui/pagination';
import AdminLayout from '@/components/AdminLayout';
import { DocumentCard, type DocumentData } from '@/components/admin/DocumentCard';

// Dynamic imports for heavy components
const BatchClassifyPanel = dynamic(() => import('@/components/BatchClassifyPanel'), {
  loading: () => <Loader2 className="w-8 h-8 animate-spin text-blue-600" />,
  ssr: false,
});

const LeiCoverageDashboard = dynamic(() => import('@/components/admin/LeiCoverageDashboard'), {
  loading: () => <div className="h-32 bg-gray-100 animate-pulse rounded-lg" />,
  ssr: false,
});

export default function DocumentosPage() {
  const { success, error: errorToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [serverPagination, setServerPagination] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [documentToPreview, setDocumentToPreview] = useState<DocumentData | null>(null);

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterVisibility, setFilterVisibility] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // New: completion status filter

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // Larger page size with server-side filtering

  // Bulk operations
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [showClassifyPanel, setShowClassifyPanel] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    complete: 0,
    warning: 0,
    critical: 0,
  });

  // Ref to prevent multiple simultaneous fetches
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const verifyAdmin = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/verify');
      if (!response.ok) {
        window.location.href = '/admin/login';
        return;
      }

      const data = await response.json();
      if (data.user.role !== 'admin') {
        window.location.href = '/admin/login';
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      window.location.href = '/admin/login';
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async (force = false) => {
    // Prevent concurrent fetches and repeated calls on error
    if (isFetchingRef.current) return;
    if (hasLoadedRef.current && !force) return;

    isFetchingRef.current = true;
    setIsLoadingDocs(true);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: itemsPerPage.toString(),
      });

      // Send category filter to server for proper server-side filtering
      if (filterCategory) {
        params.set('category', filterCategory);
      }

      const response = await fetch(`/api/admin/documents?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Erro ao carregar documentos');
      }

      setDocuments(data.documents || []);
      setServerPagination(data.pagination || null);
      hasLoadedRef.current = true;

      // Calculate stats
      const docs = data.documents || [];
      const statsCalc = { total: docs.length, complete: 0, warning: 0, critical: 0 };

      docs.forEach((doc: DocumentData) => {
        const status = getDocCompletionStatus(doc);
        if (status === 'complete') statsCalc.complete++;
        else if (status === 'warning') statsCalc.warning++;
        else statsCalc.critical++;
      });

      setStats(statsCalc);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      // Only show toast once, don't retry automatically
      if (!hasLoadedRef.current) {
        errorToast('Erro ao carregar documentos', error instanceof Error ? error.message : 'Erro desconhecido');
      }
    } finally {
      isFetchingRef.current = false;
      setIsLoadingDocs(false);
    }
  }, [currentPage, itemsPerPage, filterCategory]); // Server-side filters need to trigger refetch

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  // Reset loaded ref when page or category changes to allow new fetch
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [currentPage, filterCategory]);

  useEffect(() => {
    if (!isLoading) {
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, currentPage, filterCategory]); // Server-side filters trigger refetch

  // Completion status helper
  function getDocCompletionStatus(doc: DocumentData): 'complete' | 'warning' | 'critical' {
    if (!doc.title || !doc.category) return 'critical';

    if (doc.category === 'orientacao-normativa' && (!doc.onNumber || !doc.onYear)) {
      return 'critical';
    }

    if ((doc.category === 'enunciados' || doc.category === 'sumula') && !doc.entityType) {
      return 'critical';
    }

    // Parse arrays safely (handles both array and string formats)
    const parseArray = (value: string | string[] | undefined | null): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return value.split(',').filter(Boolean);
      }
    };

    const tags = parseArray(doc.tags);
    const articles = parseArray(doc.leiArticles);

    if (tags.length === 0 && articles.length === 0) return 'warning';
    if (!doc.description) return 'warning';

    return 'complete';
  }

  // Document selection
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
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)));
    }
  };

  // Bulk operations
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
          'Documentos excluidos com sucesso'
        );
        setSelectedDocuments(new Set());
        loadDocuments();
      } catch {
        errorToast('Erro ao deletar', 'Nao foi possivel remover os documentos');
      } finally {
        setIsDeleting(false);
      }
    } else if (bulkAction === 'markReviewed') {
      setIsDeleting(true);
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
        errorToast('Erro ao marcar', 'Nao foi possivel atualizar os documentos');
      } finally {
        setIsDeleting(false);
      }
    }

    setBulkAction('');
    setBulkCategory('');
  };

  // Export
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
      const headers = ['Titulo', 'Descricao', 'Curso', 'Categoria', 'Tipo', 'Publico', 'Data'];
      const rows = docsToExport.map(doc => {
        const course = doc.courseId ? courses.find(c => c.id === doc.courseId) : null;
        return [
          doc.title,
          doc.description || '',
          course?.title || (doc.isCommon ? 'Todos os cursos' : ''),
          doc.category,
          doc.type,
          doc.isPublic ? 'Sim' : 'Nao',
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

    success('Exportacao concluida!', `${docsToExport.length} documentos exportados em ${format.toUpperCase()}`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCourse('');
    setFilterCategory('');
    setFilterType('');
    setFilterVisibility('');
    setFilterEntity('');
    setFilterStatus('');
    setCurrentPage(1);
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    // Course filter - also include isCommon documents
    const matchesCourse = !filterCourse || doc.courseId === filterCourse || doc.isCommon;

    const matchesCategory = !filterCategory || doc.category === filterCategory;
    const matchesType = !filterType || doc.type === filterType;

    const matchesVisibility =
      !filterVisibility ||
      (filterVisibility === 'public' && doc.isPublic) ||
      (filterVisibility === 'private' && !doc.isPublic);

    const matchesEntity = !filterEntity || doc.entityType === filterEntity;

    // Completion status filter
    const docStatus = getDocCompletionStatus(doc);
    const matchesStatus = !filterStatus || docStatus === filterStatus;

    return matchesSearch && matchesCourse && matchesCategory && matchesType && matchesVisibility && matchesEntity && matchesStatus;
  });

  const activeFiltersCount = [filterCourse, filterCategory, filterType, filterVisibility, filterEntity, filterStatus].filter(Boolean).length;

  const totalPages = serverPagination?.totalPages || 1;
  const totalItems = serverPagination?.total || filteredDocuments.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCourse, filterCategory, filterType, filterVisibility, filterStatus]);

  const handleDeleteClick = (id: string) => {
    setDocumentToDelete(id);
    setDeleteDialogOpen(true);
  };

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

      success('Documento removido!', 'O documento foi excluido com sucesso.');
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      loadDocuments();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      errorToast('Erro ao deletar', 'Nao foi possivel remover o documento.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePreviewClick = (doc: DocumentData) => {
    setDocumentToPreview(doc);
    setPreviewOpen(true);
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
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Gerenciar Documentos</h2>
              <p className="text-gray-600">Visualize, edite e organize os materiais dos cursos</p>
            </div>
            <a
              href="/admin/adicionar-documentos"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Adicionar Documentos
            </a>
          </div>

          {/* Lei Coverage Dashboard */}
          <LeiCoverageDashboard />

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{serverPagination?.total || 0}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                filterStatus === 'complete' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
              }`}
              onClick={() => setFilterStatus(filterStatus === 'complete' ? '' : 'complete')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.complete}</p>
                  <p className="text-xs text-gray-500">Completos</p>
                </div>
              </div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                filterStatus === 'warning' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-yellow-300'
              }`}
              onClick={() => setFilterStatus(filterStatus === 'warning' ? '' : 'warning')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.warning}</p>
                  <p className="text-xs text-gray-500">Incompletos</p>
                </div>
              </div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                filterStatus === 'critical' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300'
              }`}
              onClick={() => setFilterStatus(filterStatus === 'critical' ? '' : 'critical')}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
                  <p className="text-xs text-gray-500">Criticos</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200">
            {/* Header with actions */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Documentos Cadastrados</h2>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => loadDocuments(true)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1"
                  title="Recarregar"
                  disabled={isLoadingDocs}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingDocs ? 'animate-spin' : ''}`} />
                </button>
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

            {/* Bulk Action Bar */}
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
                    <option value="">Selecione uma acao</option>
                    <option value="classify">Classificar Automaticamente (IA)</option>
                    <option value="markReviewed">Marcar como Revisado</option>
                    <option value="delete">Deletar selecionados</option>
                  </select>

                  <button
                    onClick={handleBulkAction}
                    disabled={!bulkAction}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Aplicar
                  </button>

                  <button
                    onClick={() => setSelectedDocuments(new Set())}
                    className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Limpar selecao
                  </button>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por titulo ou descricao..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                  <option value="acordao">Acordao</option>
                  <option value="parecer">Parecer</option>
                  <option value="orientacao-normativa">Orientacao Normativa (AGU)</option>
                  <option value="enunciados">Enunciados</option>
                  <option value="sumula">Sumula</option>
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
                  <option value="video">Video</option>
                  <option value="link">Link</option>
                </select>

                <select
                  value={filterVisibility}
                  onChange={(e) => setFilterVisibility(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                >
                  <option value="">Todas visibilidades</option>
                  <option value="public">Publico</option>
                  <option value="private">Restrito</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-600 text-gray-900 text-sm"
                >
                  <option value="">Todos os status</option>
                  <option value="complete">Completos</option>
                  <option value="warning">Incompletos</option>
                  <option value="critical">Criticos</option>
                </select>
              </div>

              {/* Entity filter (for enunciados) */}
              {filterCategory === 'enunciados' && (
                <div className="mt-3">
                  <select
                    value={filterEntity}
                    onChange={(e) => setFilterEntity(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-gray-900 text-sm bg-blue-50"
                  >
                    <option value="">Todas as entidades</option>
                    <option value="IBDA">IBDA - Instituto Brasileiro de Direito Administrativo</option>
                    <option value="INCP">INCP - Instituto Nacional da Contratacao Publica</option>
                    <option value="CJF">CJF - Conselho da Justica Federal</option>
                  </select>
                </div>
              )}

              {/* Active filters indicator */}
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

              {/* Select All */}
              {filteredDocuments.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    {selectedDocuments.size === filteredDocuments.length ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                    Selecionar todos ({filteredDocuments.length})
                  </button>

                  {selectedDocuments.size > 0 && (
                    <>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={() => setSelectedDocuments(new Set())}
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

            {/* Document List */}
            {isLoadingDocs ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nenhum documento cadastrado ainda</p>
                <a
                  href="/admin/adicionar-documentos"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar primeiro documento
                </a>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Nenhum documento encontrado</p>
                <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {filteredDocuments.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      isSelected={selectedDocuments.has(doc.id)}
                      onSelect={toggleDocumentSelection}
                      onPreview={handlePreviewClick}
                      onDelete={handleDeleteClick}
                    />
                  ))}
                </div>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalItems}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <DocumentPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        document={documentToPreview ? {
          id: documentToPreview.id,
          title: documentToPreview.title,
          description: documentToPreview.description,
          type: documentToPreview.type,
          url: documentToPreview.url,
          category: documentToPreview.category,
          courseId: documentToPreview.courseId || '',
          isPublic: documentToPreview.isPublic,
          leiArticles: documentToPreview.leiArticles,
          size: documentToPreview.size,
          uploadedAt: documentToPreview.uploadedAt,
          reviewed: documentToPreview.reviewed,
          reviewedAt: documentToPreview.reviewedAt,
          entityType: documentToPreview.entityType,
          enunciadoNumber: documentToPreview.enunciadoNumber,
        } : null}
      />

      {/* AI Classify Panel */}
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
        description="Esta acao nao pode ser desfeita. O documento sera permanentemente removido do sistema."
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        onConfirm={handleDeleteConfirm}
        variant="danger"
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
