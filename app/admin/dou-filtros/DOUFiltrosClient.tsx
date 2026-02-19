'use client';

import { useState, useEffect } from 'react';
import {
  DateRangePreset,
} from '@/lib/dou-classifier';
import { DOUDocumentModal, DOUDocument } from '@/components/DOUDocumentModal';
import { useToast } from '@/hooks/use-toast';
import { courses } from '@/data/courses';

interface StagingStats {
  totalStaging: number;
  pending: number;
  autoApproved: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  importedTotal: number;
}

interface FilterConfig {
  // Filtros básicos
  searchTerm: string;
  sections: string[];

  // Filtros por data
  datePreset: DateRangePreset | 'custom';
  dateFrom: string;
  dateTo: string;

  // Filtros por confiança
  minConfidence: number;

  // Filtros por keywords
  includeKeywords: string;
  excludeKeywords: string;

  // Configurações de busca
  maxResults: number;
}

interface SearchResult {
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

interface SearchResponse {
  results: SearchResult[];
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

interface PendingDocument {
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

export default function DOUFiltrosClient() {
  const [filters, setFilters] = useState<FilterConfig>({
    searchTerm: 'licitação OR pregão',
    sections: [],
    datePreset: DateRangePreset.ULTIMA_SEMANA,
    dateFrom: '',
    dateTo: '',
    minConfidence: 0,
    includeKeywords: '',
    excludeKeywords: '',
    maxResults: 50,
  });

  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pending documents state
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);

  // Auto-approved documents state (documentos auto-aprovados aguardando validação)
  const [autoApprovedDocs, setAutoApprovedDocs] = useState<PendingDocument[]>([]);

  // Tab state for filtering by status
  const [selectedTab, setSelectedTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [isPendingLoading, setIsPendingLoading] = useState(false);
  const [isAutoApprovedLoading, setIsAutoApprovedLoading] = useState(false);

  // Modal state
  const [selectedDocument, setSelectedDocument] = useState<DOUDocument | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Stats state
  const [stats, setStats] = useState<StagingStats | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject'>('approve');
  const [bulkCourses, setBulkCourses] = useState<string[]>([]);
  const [bulkImportAs, setBulkImportAs] = useState<'ato_normativo' | 'boa_pratica'>('ato_normativo');
  const [bulkNotes, setBulkNotes] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Toast for feedback
  const { toast } = useToast();

  // Garantir que modal só renderiza no cliente (evitar hydration mismatch)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Seções disponíveis
  const sections = [
    { value: 'do1', label: 'Seção 1 - Leis e Decretos' },
    { value: 'do2', label: 'Seção 2 - Atos de Pessoal' },
    { value: 'do3', label: 'Seção 3 - Contratos e Licitações' },
    { value: 'doe', label: 'Edições Extra' },
  ];

  // Presets de data
  const datePresets = [
    { value: DateRangePreset.HOJE, label: 'Hoje' },
    { value: DateRangePreset.ONTEM, label: 'Ontem' },
    { value: DateRangePreset.ULTIMA_SEMANA, label: 'Última semana' },
    { value: DateRangePreset.ULTIMO_MES, label: 'Último mês' },
    { value: DateRangePreset.ULTIMOS_3_MESES, label: 'Últimos 3 meses' },
    { value: 'custom', label: 'Personalizado' },
  ];

  // Fetch pending and auto-approved documents on mount
  useEffect(() => {
    const fetchPendingDocs = async () => {
      setIsPendingLoading(true);
      try {
        const response = await fetch('/api/admin/dou/pending');
        if (response.ok) {
          const data = await response.json();
          setPendingDocs(data.documents || []);
        }
      } catch (err) {
        console.error('Failed to fetch pending documents:', err);
      } finally {
        setIsPendingLoading(false);
      }
    };

    const fetchAutoApprovedDocs = async () => {
      setIsAutoApprovedLoading(true);
      try {
        const response = await fetch('/api/admin/dou/auto-approved');
        if (response.ok) {
          const data = await response.json();
          setAutoApprovedDocs(data.documents || []);
        }
      } catch (err) {
        console.error('Failed to fetch auto-approved documents:', err);
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
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchPendingDocs();
    fetchAutoApprovedDocs();
    fetchStats();
  }, []);

  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/dou/search-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar documentos');
      }

      const data = await response.json();
      setSearchResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      searchTerm: 'licitação OR pregão',
      sections: [],
      datePreset: DateRangePreset.ULTIMA_SEMANA,
      dateFrom: '',
      dateTo: '',
      minConfidence: 0,
      includeKeywords: '',
      excludeKeywords: '',
      maxResults: 50,
    });
    setSearchResponse(null);
  };

  const handleViewDetails = async (result: SearchResult) => {
    try {
      // Salvar documento no staging antes de abrir modal
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

      if (!response.ok) {
        throw new Error('Erro ao salvar documento temporário');
      }

      const { id } = await response.json();

      // Criar DOUDocument com ID do staging
      const doc: DOUDocument = {
        id, // ID do DOUStagingDocument
        title: result.title,
        abstract: result.abstract,
        url: result.href,
        section: result.section,
        publishDate: result.date,
        category: result.category,
        confidence: result.confidence,
        hierarchyStr: result.hierarchyStr,
        approvalStatus: result.status,
      };
      setSelectedDocument(doc);
      setIsModalOpen(true);
    } catch (error) {
      toast({
        title: 'Erro ao abrir detalhes',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'error',
      });
    }
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
        const error = await response.json();
        throw new Error(error.error || 'Erro ao aprovar documento');
      }

      await response.json();

      toast({
        title: 'Documento Aprovado! ✅',
        description: `${selectedDocument.title.substring(0, 60)}... foi incorporado ao acervo.`,
        variant: 'success',
      });

      setIsModalOpen(false);
      setSelectedDocument(null);

      // Recarregar listas
      reloadLists();
      if (searchResponse) handleSearch();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      toast({
        title: 'Erro ao Aprovar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'error',
      });

      // Fechar modal e limpar estado mesmo em caso de erro
      setIsModalOpen(false);
      setSelectedDocument(null);
    } finally {
      // Este setState acontece no pai, que nunca é desmontado
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
        const error = await response.json();
        throw new Error(error.error || 'Erro ao rejeitar documento');
      }

      toast({
        title: 'Documento Rejeitado',
        description: 'O documento foi marcado como rejeitado.',
        variant: 'info',
      });

      setIsModalOpen(false);
      setSelectedDocument(null);

      // Recarregar listas
      reloadLists();
      if (searchResponse) handleSearch();
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      toast({
        title: 'Erro ao Rejeitar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'error',
      });

      // Fechar modal e limpar estado mesmo em caso de erro
      setIsModalOpen(false);
      setSelectedDocument(null);
    } finally {
      // Este setState acontece no pai, que nunca é desmontado
      setIsSubmitting(false);
    }
  };

  // Recarregar listas após ações
  const reloadLists = async () => {
    const [pendingRes, autoRes, statsRes] = await Promise.all([
      fetch('/api/admin/dou/pending'),
      fetch('/api/admin/dou/auto-approved'),
      fetch('/api/admin/dou/stats'),
    ]);
    if (pendingRes.ok) {
      const data = await pendingRes.json();
      setPendingDocs(data.documents || []);
    }
    if (autoRes.ok) {
      const data = await autoRes.json();
      setAutoApprovedDocs(data.documents || []);
    }
    if (statsRes.ok) {
      const data = await statsRes.json();
      setStats(data);
    }
  };

  // Bulk selection helpers
  const allSelectableDocs = [...autoApprovedDocs, ...pendingDocs];
  const isAllSelected = allSelectableDocs.length > 0 && allSelectableDocs.every(d => selectedIds.has(d.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allSelectableDocs.map(d => d.id)));
    }
  };

  // Bulk approve/reject handler
  const handleBulkAction = async () => {
    if (selectedIds.size === 0) return;

    if (bulkAction === 'approve' && bulkCourses.length === 0) {
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
          action: bulkAction,
          courseIds: bulkAction === 'approve' ? bulkCourses : undefined,
          importAs: bulkAction === 'approve' ? bulkImportAs : undefined,
          adminNotes: bulkNotes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro na operacao em lote');
      }

      const result = await response.json();

      toast({
        title: bulkAction === 'approve'
          ? `${result.processed} documento(s) aprovado(s)`
          : `${result.processed} documento(s) rejeitado(s)`,
        description: result.errors > 0
          ? `${result.errors} erro(s) encontrado(s).`
          : 'Operacao concluida com sucesso.',
        variant: result.errors > 0 ? 'error' : 'success',
      });

      // Limpar selecao e fechar modal
      setSelectedIds(new Set());
      setIsBulkModalOpen(false);
      setBulkCourses([]);
      setBulkNotes('');

      // Recarregar listas
      await reloadLists();
      if (searchResponse) handleSearch();
    } catch (error) {
      console.error('Bulk action error:', error);
      toast({
        title: 'Erro na operacao em lote',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'error',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Handler para visualizar documentos auto-aprovados
  const handleViewAutoApprovedDoc = (doc: PendingDocument) => {
    // Montar objeto DOUDocument compatível com o modal
    const douDocument: DOUDocument = {
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
    };

    setSelectedDocument(douDocument);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Filtros Avançados DOU</h1>
          <p className="text-gray-600">
            Configure filtros para buscar documentos específicos no Diário Oficial da União
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Painel de Filtros */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">🔍 Configurar Filtros</h2>

              {/* Termo de Busca */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Termo de Busca
                </label>
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="licitação OR pregão"
                />
                <p className="text-xs text-gray-500 mt-1">Use OR, AND para combinar termos</p>
              </div>

              {/* Seções */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Seções do DOU
                </label>
                <div className="space-y-2">
                  {sections.map((section) => (
                    <label key={section.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.sections.includes(section.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({
                              ...filters,
                              sections: [...filters.sections, section.value],
                            });
                          } else {
                            setFilters({
                              ...filters,
                              sections: filters.sections.filter((s) => s !== section.value),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{section.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Data */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Período
                </label>
                <select
                  value={filters.datePreset}
                  onChange={(e) => setFilters({ ...filters, datePreset: e.target.value as DateRangePreset | 'custom' })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {datePresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                {filters.datePreset === 'custom' && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Data início"
                    />
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Data fim"
                    />
                  </div>
                )}
              </div>

              {/* Confiança Mínima */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Confiança Mínima: {filters.minConfidence}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={filters.minConfidence}
                  onChange={(e) =>
                    setFilters({ ...filters, minConfidence: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
                  💡 <strong>Confiança</strong> indica o quão certo o sistema de IA está sobre a classificação do documento.
                  Use valores maiores (70-100%) para ver apenas documentos com alta certeza de relevância.
                </p>
              </div>

              {/* Keywords */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Incluir Keywords (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={filters.includeKeywords}
                  onChange={(e) => setFilters({ ...filters, includeKeywords: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="pregão, dispensa, inexigibilidade"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Excluir Keywords (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={filters.excludeKeywords}
                  onChange={(e) => setFilters({ ...filters, excludeKeywords: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="militar, saúde, educação"
                />
              </div>

              {/* Máximo de Resultados */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Máximo de Resultados
                </label>
                <input
                  type="number"
                  value={filters.maxResults}
                  onChange={(e) =>
                    setFilters({ ...filters, maxResults: parseInt(e.target.value) || 50 })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  min="10"
                  max="500"
                />
              </div>

              {/* Botões */}
              <div className="space-y-2">
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isLoading ? '🔍 Buscando...' : '🔍 Buscar Documentos'}
                </button>
                <button
                  onClick={handleClearFilters}
                  className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                >
                  🗑️ Limpar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Painel de Resultados */}
          <div className="lg:col-span-2">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            {/* Stats Dashboard */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
                  <div className="text-2xl font-bold text-blue-700">{stats.totalStaging}</div>
                  <div className="text-xs text-gray-600">Total Staging</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
                  <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
                  <div className="text-xs text-gray-600">Pendentes</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
                  <div className="text-2xl font-bold text-green-700">{stats.autoApproved}</div>
                  <div className="text-xs text-gray-600">Auto-aprovados</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-emerald-500">
                  <div className="text-2xl font-bold text-emerald-700">{stats.approvedThisMonth}</div>
                  <div className="text-xs text-gray-600">Aprovados (mes)</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
                  <div className="text-2xl font-bold text-red-700">{stats.rejectedThisMonth}</div>
                  <div className="text-xs text-gray-600">Rejeitados (mes)</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
                  <div className="text-2xl font-bold text-purple-700">{stats.importedTotal}</div>
                  <div className="text-xs text-gray-600">Importados</div>
                </div>
              </div>
            )}

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
              <div className="sticky top-0 z-20 bg-blue-600 text-white rounded-lg shadow-lg p-3 mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">
                    {selectedIds.size} selecionado(s)
                  </span>
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs underline hover:text-blue-200"
                  >
                    {isAllSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs underline hover:text-blue-200"
                  >
                    Limpar
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setBulkAction('approve'); setIsBulkModalOpen(true); }}
                    className="px-4 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Aprovar Selecionados
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Rejeitar ${selectedIds.size} documento(s)?`)) {
                        setIsBulkProcessing(true);
                        try {
                          const response = await fetch('/api/admin/dou/bulk-approve', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              documentIds: Array.from(selectedIds),
                              action: 'reject',
                            }),
                          });
                          const result = await response.json();
                          toast({
                            title: `${result.processed} documento(s) rejeitado(s)`,
                            description: result.errors > 0 ? `${result.errors} erro(s).` : 'Concluido.',
                            variant: result.errors > 0 ? 'error' : 'success',
                          });
                          setSelectedIds(new Set());
                          await reloadLists();
                          if (searchResponse) handleSearch();
                        } catch (err) {
                          toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Erro', variant: 'error' });
                        } finally {
                          setIsBulkProcessing(false);
                        }
                      }
                    }}
                    disabled={isBulkProcessing}
                    className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isBulkProcessing ? 'Processando...' : 'Rejeitar Selecionados'}
                  </button>
                </div>
              </div>
            )}

            {/* Seção de Documentos Auto-Aprovados */}
            {isAutoApprovedLoading ? (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin text-4xl mb-2">✅</div>
                  <p>Carregando documentos auto-aprovados...</p>
                </div>
              </div>
            ) : autoApprovedDocs.length > 0 ? (
              <div className="bg-green-50 border-2 border-green-400 rounded-lg shadow-md p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-green-900">
                    ✅ Documentos Auto-Aprovados - Validação Necessária
                  </h2>
                  <span className="bg-green-200 text-green-900 px-3 py-1 rounded-full text-sm font-bold">
                    {autoApprovedDocs.length} {autoApprovedDocs.length === 1 ? 'documento' : 'documentos'}
                  </span>
                </div>
                <p className="text-sm text-green-800 mb-4">
                  🤖 Documentos classificados como alta relevância pelo sistema automático.
                  <strong> Revise e valide</strong> para incorporar ao acervo.
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {autoApprovedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white border border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer flex gap-3"
                    >
                      <div className="flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1" onClick={() => handleViewAutoApprovedDoc(doc)}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded uppercase font-bold">
                                {doc.section}
                              </span>
                              <span className="text-xs text-gray-500">
                                {doc.publishDate}
                              </span>
                            </div>
                            <h3
                              className="font-medium text-sm mb-1 text-gray-900"
                              dangerouslySetInnerHTML={{
                                __html: doc.title.substring(0, 150) + (doc.title.length > 150 ? '...' : ''),
                              }}
                            />
                            {doc.hierarchyStr && (
                              <div className="text-xs text-gray-600">{doc.hierarchyStr}</div>
                            )}
                            {doc.abstract && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {doc.abstract.substring(0, 250)}{doc.abstract.length > 250 ? '...' : ''}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="bg-green-100 text-green-900 px-2 py-1 rounded font-bold">
                              Auto-aprovado
                            </span>
                            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded font-medium">
                              {doc.category}
                            </span>
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">
                              {doc.confidence}% confianca
                            </span>
                          </div>
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium"
                            >
                              Inteiro Teor
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-green-200">
                  <p className="text-xs text-green-800">
                    Clique em um documento para revisar ou use os checkboxes para operacoes em lote.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Seção de Documentos Pendentes */}
            {isPendingLoading ? (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin text-4xl mb-2">⏳</div>
                  <p>Carregando documentos pendentes...</p>
                </div>
              </div>
            ) : pendingDocs.length > 0 ? (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow-md p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-yellow-900">
                    ⏳ Documentos Pendentes de Revisão
                  </h2>
                  <span className="bg-yellow-200 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold">
                    {pendingDocs.length} {pendingDocs.length === 1 ? 'documento' : 'documentos'}
                  </span>
                </div>
                <p className="text-sm text-yellow-800 mb-4">
                  📋 Estes documentos foram classificados como potencialmente relevantes e aguardam aprovação manual.
                </p>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {pendingDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white border border-yellow-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer flex gap-3"
                    >
                      <div className="flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1" onClick={() => handleViewAutoApprovedDoc(doc)}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded uppercase font-bold">
                                {doc.section}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(doc.publishDate).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <h3
                              className="font-medium text-sm mb-1 text-gray-900"
                              dangerouslySetInnerHTML={{
                                __html: doc.title.substring(0, 150) + (doc.title.length > 150 ? '...' : ''),
                              }}
                            />
                            {doc.hierarchyStr && (
                              <div className="text-xs text-gray-600">{doc.hierarchyStr}</div>
                            )}
                            {doc.abstract && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {doc.abstract.substring(0, 250)}{doc.abstract.length > 250 ? '...' : ''}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium">
                              Aguardando revisao
                            </span>
                            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                              {doc.category}
                            </span>
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              Confianca: {doc.confidence}%
                            </span>
                          </div>
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium"
                            >
                              Inteiro Teor
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-yellow-200">
                  <p className="text-xs text-yellow-800">
                    Clique em um documento para revisar ou use os checkboxes para operacoes em lote.
                  </p>
                </div>
              </div>
            ) : null}

            {searchResponse && (
              <>
                {/* Estatísticas */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4">📊 Estatísticas</h2>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900">
                        {searchResponse.stats.total}
                      </div>
                      <div className="text-sm text-gray-600">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {searchResponse.stats.autoApproved}
                      </div>
                      <div className="text-sm text-gray-600">Auto-aprovados</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600">
                        {searchResponse.stats.pending}
                      </div>
                      <div className="text-sm text-gray-600">Revisão</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">
                        {searchResponse.stats.autoRejected}
                      </div>
                      <div className="text-sm text-gray-600">Rejeitados</div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2">Impacto dos Filtros:</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Documentos filtrados:</span>
                        <span className="font-bold ml-2">
                          {searchResponse.filterStats.filteredCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Removidos:</span>
                        <span className="font-bold ml-2">
                          {searchResponse.filterStats.removedCount} (
                          {searchResponse.filterStats.removalRate})
                        </span>
                      </div>
                    </div>
                    {searchResponse.filterStats.appliedFilters.length > 0 && (
                      <div className="mt-2">
                        <span className="text-gray-600 text-sm">Filtros aplicados:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {searchResponse.filterStats.appliedFilters.map((filter, i) => (
                            <span
                              key={i}
                              className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                            >
                              {filter}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lista de Documentos com Abas por Status */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold mb-2">
                    📄 Documentos Encontrados ({searchResponse.results.length})
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Ordenados por: ⏳ Revisão → ✅ Auto-aprovados → ❌ Rejeitados
                  </p>

                  {/* Abas de Status */}
                  <div className="flex gap-2 mb-6 border-b border-gray-200">
                    {[
                      { key: 'pending' as const, label: '⏳ Revisão', count: searchResponse.results.filter(r => r.status === 'pending').length },
                      { key: 'approved' as const, label: '✅ Auto-aprovados', count: searchResponse.results.filter(r => r.status === 'auto_approved').length },
                      { key: 'rejected' as const, label: '❌ Rejeitados', count: searchResponse.results.filter(r => r.status === 'auto_rejected').length },
                      { key: 'all' as const, label: '📋 Todos', count: searchResponse.results.length },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedTab(tab.key)}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                          selectedTab === tab.key
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const filteredResults = selectedTab === 'all'
                      ? searchResponse.results
                      : searchResponse.results.filter(r => {
                          if (selectedTab === 'pending') return r.status === 'pending';
                          if (selectedTab === 'approved') return r.status === 'auto_approved';
                          if (selectedTab === 'rejected') return r.status === 'auto_rejected';
                          return true;
                        });

                    return filteredResults.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <div className="text-4xl mb-2">🔍</div>
                        <p>Nenhum documento encontrado nesta categoria</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredResults.map((result, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded uppercase font-bold">
                                  {result.section}
                                </span>
                                <span className="text-xs text-gray-500">{result.date}</span>
                              </div>
                              <h3
                                className="font-medium text-sm mb-1"
                                dangerouslySetInnerHTML={{
                                  __html: result.title.substring(0, 150) + '...',
                                }}
                              />
                              <div className="text-xs text-gray-600">{result.hierarchyStr}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span
                                className={`px-2 py-1 rounded ${
                                  result.status === 'auto_approved'
                                    ? 'bg-green-100 text-green-800'
                                    : result.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {result.status === 'auto_approved'
                                  ? '✅ Auto-aprovado'
                                  : result.status === 'pending'
                                  ? '⏳ Revisão'
                                  : '❌ Rejeitado'}
                              </span>
                              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                {result.category}
                              </span>
                              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                Confiança: {result.confidence}%
                              </span>
                            </div>

                            <button
                              onClick={() => handleViewDetails(result)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                            >
                              📄 Ver Detalhes
                            </button>
                          </div>
                        </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}

            {!searchResponse && !isLoading && (
              <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold mb-2">Configure os filtros e busque</h3>
                <p>
                  Use o painel à esquerda para configurar filtros avançados e encontrar documentos
                  específicos no DOU
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Visualização e Aprovação */}
      {isMounted && selectedDocument && isModalOpen && (
        <DOUDocumentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          document={selectedDocument}
          onApprove={handleApproveDocument}
          onReject={handleRejectDocument}
          isRejecting={isSubmitting}
          isApproving={isSubmitting}
        />
      )}

      {/* Bulk Approve Modal */}
      {isMounted && isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-bold mb-4">
              Aprovar {selectedIds.size} documento(s) em lote
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Importar como:
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-blue-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                    <input
                      type="radio"
                      name="bulkImportAs"
                      checked={bulkImportAs === 'ato_normativo'}
                      onChange={() => setBulkImportAs('ato_normativo')}
                    />
                    <span className="text-sm">Ato Normativo</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-green-50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                    <input
                      type="radio"
                      name="bulkImportAs"
                      checked={bulkImportAs === 'boa_pratica'}
                      onChange={() => setBulkImportAs('boa_pratica')}
                    />
                    <span className="text-sm">Boa Pratica</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Vincular aos cursos: *
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg border">
                  {courses.map((course) => (
                    <label
                      key={course.id}
                      className="flex items-start gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={bulkCourses.includes(course.id)}
                        onChange={() => {
                          setBulkCourses(prev =>
                            prev.includes(course.id)
                              ? prev.filter(id => id !== course.id)
                              : [...prev, course.id]
                          );
                        }}
                        className="mt-1"
                      />
                      <span className="text-sm flex-1">{course.title}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {bulkCourses.length} curso(s) selecionado(s)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Observacoes (opcional)
                </label>
                <textarea
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="Observacoes para todos os documentos..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                disabled={isBulkProcessing}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkAction}
                disabled={isBulkProcessing || bulkCourses.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkProcessing ? 'Processando...' : `Aprovar ${selectedIds.size} documento(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
