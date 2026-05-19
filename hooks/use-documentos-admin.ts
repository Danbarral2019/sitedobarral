'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getDocCompletionStatus } from '@/lib/admin/document-status';
import type { DocumentData } from '@/components/admin/DocumentCard';

const ITEMS_PER_PAGE = 50;

export interface DocumentFilters {
  course: string;
  category: string;
  type: string;
  visibility: string;
  entity: string;
  status: string;
}

const EMPTY_FILTERS: DocumentFilters = {
  course: '',
  category: '',
  type: '',
  visibility: '',
  entity: '',
  status: '',
};

export interface ServerPagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DocumentStats {
  total: number;
  complete: number;
  warning: number;
  critical: number;
}

export function useDocumentosAdmin() {
  const { success, error: errorToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [serverPagination, setServerPagination] = useState<ServerPagination | null>(null);
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    complete: 0,
    warning: 0,
    critical: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<DocumentFilters>(EMPTY_FILTERS);

  const [currentPage, setCurrentPage] = useState(1);

  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [showClassifyPanel, setShowClassifyPanel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [documentToPreview, setDocumentToPreview] = useState<DocumentData | null>(null);

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

  const loadDocuments = useCallback(
    async (force = false) => {
      if (isFetchingRef.current) return;
      if (hasLoadedRef.current && !force) return;

      isFetchingRef.current = true;
      setIsLoadingDocs(true);

      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          pageSize: ITEMS_PER_PAGE.toString(),
        });
        if (filters.category) {
          params.set('category', filters.category);
        }

        const response = await fetch(`/api/admin/documents?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.details || 'Erro ao carregar documentos');
        }

        setDocuments(data.documents || []);
        setServerPagination(data.pagination || null);
        hasLoadedRef.current = true;

        const docs: DocumentData[] = data.documents || [];
        const statsCalc: DocumentStats = { total: docs.length, complete: 0, warning: 0, critical: 0 };
        for (const doc of docs) {
          const status = getDocCompletionStatus(doc);
          if (status === 'complete') statsCalc.complete++;
          else if (status === 'warning') statsCalc.warning++;
          else statsCalc.critical++;
        }
        setStats(statsCalc);
      } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        if (!hasLoadedRef.current) {
          errorToast(
            'Erro ao carregar documentos',
            error instanceof Error ? error.message : 'Erro desconhecido',
          );
        }
      } finally {
        isFetchingRef.current = false;
        setIsLoadingDocs(false);
      }
    },
    [currentPage, filters.category, errorToast],
  );

  useEffect(() => {
    verifyAdmin();
  }, [verifyAdmin]);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [currentPage, filters.category]);

  useEffect(() => {
    if (!isLoading) {
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, currentPage, filters.category]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.course, filters.category, filters.type, filters.visibility, filters.status]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

      const matchesCourse = !filters.course || doc.courseId === filters.course || doc.isCommon;
      const matchesCategory = !filters.category || doc.category === filters.category;
      const matchesType = !filters.type || doc.type === filters.type;

      const matchesVisibility =
        !filters.visibility ||
        (filters.visibility === 'public' && doc.isPublic) ||
        (filters.visibility === 'private' && !doc.isPublic);

      const matchesEntity = !filters.entity || doc.entityType === filters.entity;

      const docStatus = getDocCompletionStatus(doc);
      const matchesStatus = !filters.status || docStatus === filters.status;

      return (
        matchesSearch &&
        matchesCourse &&
        matchesCategory &&
        matchesType &&
        matchesVisibility &&
        matchesEntity &&
        matchesStatus
      );
    });
  }, [documents, searchTerm, filters]);

  const activeFiltersCount = useMemo(
    () =>
      [filters.course, filters.category, filters.type, filters.visibility, filters.entity, filters.status].filter(
        Boolean,
      ).length,
    [filters],
  );

  const totalPages = serverPagination?.totalPages || 1;
  const totalItems = serverPagination?.total || filteredDocuments.length;

  const setFilter = useCallback(
    <K extends keyof DocumentFilters>(key: K, value: DocumentFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  }, []);

  const toggleDocumentSelection = useCallback((id: string) => {
    setSelectedDocuments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedDocuments((prev) =>
      prev.size === filteredDocuments.length
        ? new Set()
        : new Set(filteredDocuments.map((d) => d.id)),
    );
  }, [filteredDocuments]);

  const clearSelection = useCallback(() => {
    setSelectedDocuments(new Set());
  }, []);

  const handleBulkAction = useCallback(async () => {
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
      setIsProcessing(true);
      try {
        const ids = Array.from(selectedDocuments);
        await Promise.all(
          ids.map((id) =>
            fetch('/api/admin/documents', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id }),
            }),
          ),
        );
        success(
          `${ids.length} documento${ids.length !== 1 ? 's' : ''} removido${ids.length !== 1 ? 's' : ''}!`,
          'Documentos excluidos com sucesso',
        );
        setSelectedDocuments(new Set());
        await loadDocuments(true);
      } catch {
        errorToast('Erro ao deletar', 'Nao foi possivel remover os documentos');
      } finally {
        setIsProcessing(false);
      }
    } else if (bulkAction === 'markReviewed') {
      setIsProcessing(true);
      try {
        const ids = Array.from(selectedDocuments);
        await Promise.all(
          ids.map((id) =>
            fetch(`/api/admin/documents/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reviewed: true }),
            }),
          ),
        );
        success(
          `${ids.length} documento${ids.length !== 1 ? 's' : ''} marcado${ids.length !== 1 ? 's' : ''} como revisado!`,
          'Documentos atualizados com sucesso',
        );
        setSelectedDocuments(new Set());
        await loadDocuments(true);
      } catch {
        errorToast('Erro ao marcar', 'Nao foi possivel atualizar os documentos');
      } finally {
        setIsProcessing(false);
      }
    }

    setBulkAction('');
  }, [bulkAction, selectedDocuments, success, errorToast, loadDocuments]);

  const handleDeleteClick = useCallback((id: string) => {
    setDocumentToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!documentToDelete) return;

    setIsProcessing(true);
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
      await loadDocuments(true);
    } catch (error) {
      console.error('Erro ao deletar:', error);
      errorToast('Erro ao deletar', 'Nao foi possivel remover o documento.');
    } finally {
      setIsProcessing(false);
    }
  }, [documentToDelete, success, errorToast, loadDocuments]);

  const handlePreviewClick = useCallback((doc: DocumentData) => {
    setDocumentToPreview(doc);
    setPreviewOpen(true);
  }, []);

  return {
    isLoading,
    isLoadingDocs,
    documents,
    filteredDocuments,
    stats,
    serverPagination,
    searchTerm,
    setSearchTerm,
    filters,
    setFilter,
    clearFilters,
    activeFiltersCount,
    currentPage,
    setCurrentPage,
    itemsPerPage: ITEMS_PER_PAGE,
    totalPages,
    totalItems,
    selectedDocuments,
    toggleDocumentSelection,
    toggleSelectAll,
    clearSelection,
    bulkAction,
    setBulkAction,
    handleBulkAction,
    isProcessing,
    showClassifyPanel,
    setShowClassifyPanel,
    deleteDialog: {
      open: deleteDialogOpen,
      onOpenChange: setDeleteDialogOpen,
      onConfirm: handleDeleteConfirm,
    },
    previewDialog: {
      open: previewOpen,
      onOpenChange: setPreviewOpen,
      doc: documentToPreview,
    },
    handleDeleteClick,
    handlePreviewClick,
    loadDocuments,
  };
}
