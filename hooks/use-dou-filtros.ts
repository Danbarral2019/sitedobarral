'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { DOUDocument } from '@/components/DOUDocumentModal';
import { DEFAULT_DOU_FILTERS, type DOUFilterConfig } from '@/lib/admin/dou-filtros/defaults';

export interface DOUStagingStats {
  totalStaging: number;
  pending: number;
  autoApproved: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  importedTotal: number;
}

export interface DOUSearchResult {
  section: string;
  title: string;
  date: string;
  category: string;
  status: string;
  confidence: number;
  hierarchyStr: string;
  abstract: string;
  href: string;
}

export interface DOUSearchResponse {
  results: DOUSearchResult[];
  stats: {
    total: number;
    autoApproved: number;
    pending: number;
    autoRejected: number;
    filtered: number;
  };
  filterStats: {
    originalCount: number;
    filteredCount: number;
    removedCount: number;
    removalRate: string;
    appliedFilters: string[];
  };
}

export interface DOUPendingDocument {
  id: string;
  section: string;
  title: string;
  publishDate: string;
  category: string;
  confidence: number;
  hierarchyStr: string;
  approvalStatus: string;
  url?: string;
  abstract?: string;
  fullContent?: string;
}

export type DOUStatusTab = 'all' | 'pending' | 'approved' | 'rejected';
export type DOUBulkAction = 'approve' | 'reject';
export type DOUImportAs = 'ato_normativo' | 'boa_pratica';

export function useDouFiltros() {
  const { toast } = useToast();

  const [filters, setFilters] = useState<DOUFilterConfig>(DEFAULT_DOU_FILTERS);
  const [searchResponse, setSearchResponse] = useState<DOUSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingDocs, setPendingDocs] = useState<DOUPendingDocument[]>([]);
  const [autoApprovedDocs, setAutoApprovedDocs] = useState<DOUPendingDocument[]>([]);

  const [selectedTab, setSelectedTab] = useState<DOUStatusTab>('pending');
  const [isPendingLoading, setIsPendingLoading] = useState(false);
  const [isAutoApprovedLoading, setIsAutoApprovedLoading] = useState(false);

  const [selectedDocument, setSelectedDocument] = useState<DOUDocument | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [stats, setStats] = useState<DOUStagingStats | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<DOUBulkAction>('approve');
  const [bulkCourses, setBulkCourses] = useState<string[]>([]);
  const [bulkImportAs, setBulkImportAs] = useState<DOUImportAs>('ato_normativo');
  const [bulkNotes, setBulkNotes] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchPending = async () => {
    setIsPendingLoading(true);
    try {
      const response = await fetch('/api/admin/dou/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingDocs(data.documents || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsPendingLoading(false);
    }
  };

  const fetchAutoApproved = async () => {
    setIsAutoApprovedLoading(true);
    try {
      const response = await fetch('/api/admin/dou/auto-approved');
      if (response.ok) {
        const data = await response.json();
        setAutoApprovedDocs(data.documents || []);
      }
    } catch {
      // silently fail
    } finally {
      setIsAutoApprovedLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/dou/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchPending();
    fetchAutoApproved();
    fetchStats();
  }, []);

  const reloadLists = async () => {
    await Promise.all([fetchPending(), fetchAutoApproved(), fetchStats()]);
  };

  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/dou/search-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!response.ok) throw new Error('Erro ao buscar documentos');
      const data = await response.json();
      setSearchResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_DOU_FILTERS);
    setSearchResponse(null);
  };

  const handleViewDetails = async (result: DOUSearchResult) => {
    try {
      const response = await fetch('/api/admin/dou/save-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.title,
          abstract: result.abstract,
          url: result.href,
          section: result.section,
          publishDate: result.date,
          category: result.category,
          confidence: result.confidence,
          hierarchyStr: result.hierarchyStr,
          approvalStatus: result.status,
        }),
      });
      if (!response.ok) throw new Error('Erro ao salvar documento temporário');
      const { id } = await response.json();
      setSelectedDocument({
        id,
        title: result.title,
        abstract: result.abstract,
        url: result.href,
        section: result.section,
        publishDate: result.date,
        category: result.category,
        confidence: result.confidence,
        hierarchyStr: result.hierarchyStr,
        approvalStatus: result.status,
      });
      setIsModalOpen(true);
    } catch (err) {
      toast({
        title: 'Erro ao abrir detalhes',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'error',
      });
    }
  };

  const handleViewStagingDoc = (doc: DOUPendingDocument) => {
    setSelectedDocument({
      id: doc.id,
      title: doc.title,
      abstract: doc.abstract || '',
      url: doc.url || '',
      section: doc.section,
      publishDate: doc.publishDate,
      category: doc.category,
      confidence: doc.confidence,
      hierarchyStr: doc.hierarchyStr,
      approvalStatus: doc.approvalStatus,
    });
    setIsModalOpen(true);
  };

  const handleApproveDocument = async (courseIds: string[], adminNotes?: string, importAs?: string) => {
    if (!selectedDocument) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/dou/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          action: 'approve',
          courseIds,
          adminNotes,
          importAs: importAs || 'ato_normativo',
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao aprovar documento');
      }
      await response.json();
      toast({
        title: 'Documento Aprovado! ✅',
        description: `${selectedDocument.title.substring(0, 60)}... foi incorporado ao acervo.`,
        variant: 'success',
      });
      setIsModalOpen(false);
      setSelectedDocument(null);
      reloadLists();
      if (searchResponse) handleSearch();
    } catch (err) {
      toast({
        title: 'Erro ao Aprovar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'error',
      });
      setIsModalOpen(false);
      setSelectedDocument(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectDocument = async (reason?: string) => {
    if (!selectedDocument) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/dou/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          action: 'reject',
          adminNotes: reason,
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao rejeitar documento');
      }
      toast({
        title: 'Documento Rejeitado',
        description: 'O documento foi marcado como rejeitado.',
        variant: 'info',
      });
      setIsModalOpen(false);
      setSelectedDocument(null);
      reloadLists();
      if (searchResponse) handleSearch();
    } catch (err) {
      toast({
        title: 'Erro ao Rejeitar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'error',
      });
      setIsModalOpen(false);
      setSelectedDocument(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelectableDocs = [...autoApprovedDocs, ...pendingDocs];
  const isAllSelected =
    allSelectableDocs.length > 0 && allSelectableDocs.every((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allSelectableDocs.map((d) => d.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openBulkApproveModal = () => {
    setBulkAction('approve');
    setIsBulkModalOpen(true);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    if (bulkCourses.length === 0) {
      toast({
        title: 'Selecione pelo menos um curso',
        description: 'Para aprovar em lote, selecione os cursos para vincular.',
        variant: 'error',
      });
      return;
    }
    setIsBulkProcessing(true);
    try {
      const response = await fetch('/api/admin/dou/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedIds),
          action: 'approve',
          courseIds: bulkCourses,
          importAs: bulkImportAs,
          adminNotes: bulkNotes.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro na operacao em lote');
      }
      const result = await response.json();
      toast({
        title: `${result.processed} documento(s) aprovado(s)`,
        description:
          result.errors > 0 ? `${result.errors} erro(s) encontrado(s).` : 'Operacao concluida com sucesso.',
        variant: result.errors > 0 ? 'error' : 'success',
      });
      clearSelection();
      setIsBulkModalOpen(false);
      setBulkCourses([]);
      setBulkNotes('');
      await reloadLists();
      if (searchResponse) handleSearch();
    } catch (err) {
      toast({
        title: 'Erro na operacao em lote',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'error',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Rejeitar ${selectedIds.size} documento(s)?`)) return;
    setIsBulkProcessing(true);
    try {
      const response = await fetch('/api/admin/dou/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: Array.from(selectedIds), action: 'reject' }),
      });
      const result = await response.json();
      toast({
        title: `${result.processed} documento(s) rejeitado(s)`,
        description: result.errors > 0 ? `${result.errors} erro(s).` : 'Concluido.',
        variant: result.errors > 0 ? 'error' : 'success',
      });
      clearSelection();
      await reloadLists();
      if (searchResponse) handleSearch();
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro',
        variant: 'error',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return {
    // Filters
    filters,
    setFilters,
    handleSearch,
    handleClearFilters,
    isLoading,
    error,

    // Stats
    stats,

    // Search response
    searchResponse,
    selectedTab,
    setSelectedTab,

    // Staging lists
    pendingDocs,
    autoApprovedDocs,
    isPendingLoading,
    isAutoApprovedLoading,

    // Selection
    selectedIds,
    toggleSelect,
    isAllSelected,
    toggleSelectAll,
    clearSelection,

    // Bulk
    isBulkModalOpen,
    setIsBulkModalOpen,
    bulkAction,
    bulkCourses,
    setBulkCourses,
    bulkImportAs,
    setBulkImportAs,
    bulkNotes,
    setBulkNotes,
    isBulkProcessing,
    openBulkApproveModal,
    handleBulkApprove,
    handleBulkReject,

    // Single doc modal
    isMounted,
    selectedDocument,
    isModalOpen,
    setIsModalOpen,
    isSubmitting,
    handleViewDetails,
    handleViewStagingDoc,
    handleApproveDocument,
    handleRejectDocument,
  };
}
