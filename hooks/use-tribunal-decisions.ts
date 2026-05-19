'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface TribunalStats {
  total: number;
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  byTribunal: Array<{
    tribunalCode: string;
    tribunalName: string;
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  }>;
}

export interface ScraperHealthEntry {
  scraperCode: string;
  lastRun: {
    status: string;
    itemsFound: number;
    itemsNew: number;
    itemsError: number;
    duration: number;
    errorMessage: string | null;
    runAt: string;
  };
  consecutiveFailures: number;
  isHealthy: boolean;
  totalRuns: number;
}

export interface TribunalDecision {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionNumber: string;
  decisionType: string;
  title: string;
  ementa: string;
  fullText: string | null;
  summary: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: string | null;
  themes: string | null;
  leiArticles: string | null;
  url: string | null;
  relevanceScore: number;
  confidence: number;
  approvalStatus: string;
  createdAt: string;
}

export type DecisionTab =
  | 'pending'
  | 'auto_approved'
  | 'manually_approved'
  | 'auto_rejected'
  | 'manually_rejected'
  | 'all';

export type DecisionSort = 'createdAt' | 'relevanceScore';

const PAGE_SIZE = 20;

export function useTribunalDecisions() {
  const { toast } = useToast();

  // Stats
  const [stats, setStats] = useState<TribunalStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Scraper Health
  const [scraperHealth, setScraperHealth] = useState<ScraperHealthEntry[]>([]);
  const [scraperHealthLoading, setScraperHealthLoading] = useState(true);
  const [runningScrapers, setRunningScrapers] = useState<Set<string>>(new Set());

  // Decisions list
  const [decisions, setDecisions] = useState<TribunalDecision[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [totalDecisions, setTotalDecisions] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [activeTab, setActiveTab] = useState<DecisionTab>('pending');
  const [filterTribunal, setFilterTribunal] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<DecisionSort>('relevanceScore');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Bulk processing
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tribunal-decisions/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchScraperHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tribunal-decisions/scraper-health');
      if (res.ok) {
        const data = await res.json();
        setScraperHealth(data.scrapers || []);
      }
    } catch (err) {
      console.error('Failed to fetch scraper health:', err);
    } finally {
      setScraperHealthLoading(false);
    }
  }, []);

  const fetchDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
        sort: sortBy,
      });
      if (activeTab !== 'all') params.set('status', activeTab);
      if (filterTribunal) params.set('tribunal', filterTribunal);
      if (searchText) params.set('q', searchText);

      const res = await fetch(`/api/admin/tribunal-decisions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDecisions(data.items);
        setTotalDecisions(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch decisions:', err);
    } finally {
      setDecisionsLoading(false);
    }
  }, [currentPage, activeTab, filterTribunal, searchText, sortBy]);

  useEffect(() => {
    fetchStats();
    fetchScraperHealth();
  }, [fetchStats, fetchScraperHealth]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeTab, filterTribunal, searchText, sortBy]);

  const handleRunScraper = useCallback(
    async (scraperCode: string) => {
      setRunningScrapers((prev) => new Set(prev).add(scraperCode));
      try {
        const res = await fetch('/api/admin/tribunal-decisions/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scraperCode }),
        });
        if (res.ok) {
          const data = await res.json();
          toast({
            title: 'Scraper executado',
            description: `${data.result?.itemsNew || 0} nova(s) decisao(oes) encontrada(s).`,
            variant: 'success',
          });
          fetchStats();
          fetchScraperHealth();
          fetchDecisions();
        } else {
          const err = await res.json();
          throw new Error(err.error || 'Falha ao executar scraper');
        }
      } catch (err) {
        toast({
          title: 'Erro ao executar scraper',
          description: err instanceof Error ? err.message : 'Erro desconhecido',
          variant: 'error',
        });
      } finally {
        setRunningScrapers((prev) => {
          const next = new Set(prev);
          next.delete(scraperCode);
          return next;
        });
      }
    },
    [toast, fetchStats, fetchScraperHealth, fetchDecisions],
  );

  const handleApprove = useCallback(
    async (id: string) => {
      try {
        const res = await fetch('/api/admin/tribunal-decisions/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'approve' }),
        });
        if (res.ok) {
          toast({ title: 'Decisao aprovada', variant: 'success' });
          fetchStats();
          fetchDecisions();
        } else {
          throw new Error('Falha ao aprovar');
        }
      } catch (err) {
        toast({
          title: 'Erro ao aprovar',
          description: err instanceof Error ? err.message : 'Erro',
          variant: 'error',
        });
      }
    },
    [toast, fetchStats, fetchDecisions],
  );

  const handleReject = useCallback(
    async (id: string) => {
      try {
        const res = await fetch('/api/admin/tribunal-decisions/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'reject' }),
        });
        if (res.ok) {
          toast({ title: 'Decisao rejeitada', variant: 'info' });
          fetchStats();
          fetchDecisions();
        } else {
          throw new Error('Falha ao rejeitar');
        }
      } catch (err) {
        toast({
          title: 'Erro ao rejeitar',
          description: err instanceof Error ? err.message : 'Erro',
          variant: 'error',
        });
      }
    },
    [toast, fetchStats, fetchDecisions],
  );

  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const res = await fetch('/api/admin/tribunal-decisions/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: 'approve' }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: `${data.updatedCount} decisao(oes) aprovada(s)`,
          description: 'Concluido.',
          variant: 'success',
        });
        setSelectedIds(new Set());
        fetchStats();
        fetchDecisions();
      }
    } catch (err) {
      toast({
        title: 'Erro na operacao em lote',
        description: err instanceof Error ? err.message : 'Erro',
        variant: 'error',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  }, [selectedIds, toast, fetchStats, fetchDecisions]);

  const handleBulkReject = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Rejeitar ${selectedIds.size} decisao(oes)?`)) return;
    setIsBulkProcessing(true);
    try {
      const res = await fetch('/api/admin/tribunal-decisions/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: 'reject' }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: `${data.updatedCount} decisao(oes) rejeitada(s)`,
          variant: 'success',
        });
        setSelectedIds(new Set());
        fetchStats();
        fetchDecisions();
      }
    } catch (err) {
      toast({
        title: 'Erro na operacao em lote',
        description: err instanceof Error ? err.message : 'Erro',
        variant: 'error',
      });
    } finally {
      setIsBulkProcessing(false);
    }
  }, [selectedIds, toast, fetchStats, fetchDecisions]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === decisions.length ? new Set() : new Set(decisions.map((d) => d.id)),
    );
  }, [decisions]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const availableTribunals = stats?.byTribunal.map((t) => t.tribunalCode) || [];

  return {
    // Stats
    stats,
    statsLoading,
    availableTribunals,

    // Scraper Health
    scraperHealth,
    scraperHealthLoading,
    runningScrapers,
    handleRunScraper,

    // Decisions list
    decisions,
    decisionsLoading,
    totalDecisions,
    totalPages,
    currentPage,
    setCurrentPage,
    pageSize: PAGE_SIZE,

    // Filters
    activeTab,
    setActiveTab,
    filterTribunal,
    setFilterTribunal,
    searchText,
    setSearchText,
    sortBy,
    setSortBy,

    // Selection
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    expandedIds,
    toggleExpand,

    // Actions
    handleApprove,
    handleReject,
    handleBulkApprove,
    handleBulkReject,
    isBulkProcessing,
  };
}
