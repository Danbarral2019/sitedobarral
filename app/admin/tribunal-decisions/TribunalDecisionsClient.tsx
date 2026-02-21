'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Scale, CheckCircle, XCircle, AlertTriangle, RefreshCw, Search,
  Filter, ChevronDown, ChevronUp, ExternalLink, Clock, Building2,
  Loader2, FileText, Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Stats {
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

interface ScraperHealthEntry {
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

interface TribunalDecision {
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

interface PaginatedResponse {
  items: TribunalDecision[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function TribunalDecisionsClient() {
  const { toast } = useToast();

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
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
  const [activeTab, setActiveTab] = useState<'pending' | 'auto_approved' | 'manually_approved' | 'auto_rejected' | 'manually_rejected' | 'all'>('pending');
  const [filterTribunal, setFilterTribunal] = useState('');
  const [searchText, setSearchText] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Bulk processing
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const pageSize = 20;

  // Fetch stats
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

  // Fetch scraper health
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

  // Fetch decisions
  const fetchDecisions = useCallback(async () => {
    setDecisionsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize),
      });
      if (activeTab !== 'all') params.set('status', activeTab);
      if (filterTribunal) params.set('tribunal', filterTribunal);
      if (searchText) params.set('q', searchText);

      const res = await fetch(`/api/admin/tribunal-decisions?${params}`);
      if (res.ok) {
        const data: PaginatedResponse = await res.json();
        setDecisions(data.items);
        setTotalDecisions(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch decisions:', err);
    } finally {
      setDecisionsLoading(false);
    }
  }, [currentPage, activeTab, filterTribunal, searchText]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchScraperHealth();
  }, [fetchStats, fetchScraperHealth]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [activeTab, filterTribunal, searchText]);

  // Run scraper
  const handleRunScraper = async (scraperCode: string) => {
    setRunningScrapers(prev => new Set(prev).add(scraperCode));
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
      setRunningScrapers(prev => {
        const next = new Set(prev);
        next.delete(scraperCode);
        return next;
      });
    }
  };

  // Approve single decision
  const handleApprove = async (id: string) => {
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
  };

  // Reject single decision
  const handleReject = async (id: string) => {
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
  };

  // Bulk approve
  const handleBulkApprove = async () => {
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
  };

  // Bulk reject
  const handleBulkReject = async () => {
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
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === decisions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(decisions.map(d => d.id)));
    }
  };

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Relative time
  const relativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min atras`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h atras`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 30) return `${diffDays}d atras`;
    return date.toLocaleDateString('pt-BR');
  };

  // Tribunal badge color
  const tribunalColor = (tribunal: string) => {
    const colors: Record<string, string> = {
      'TCE-SP': 'bg-blue-100 text-blue-800',
      'TCE-MG': 'bg-green-100 text-green-800',
      'TCE-PR': 'bg-purple-100 text-purple-800',
      'TCE-SC': 'bg-sky-100 text-sky-800',
      'TCE-RJ': 'bg-orange-100 text-orange-800',
      'TCE-RS': 'bg-violet-100 text-violet-800',
      'TCE-PE': 'bg-teal-100 text-teal-800',
      'TCU': 'bg-red-100 text-red-800',
      'DATAJUD-STJ': 'bg-red-100 text-red-800',
    };
    return colors[tribunal] || 'bg-gray-100 text-gray-800';
  };

  // Scraper health status badge
  const healthBadge = (isHealthy: boolean, consecutiveFailures: number) => {
    if (isHealthy && consecutiveFailures === 0) {
      return { color: 'bg-green-50 border-green-200', icon: <CheckCircle className="w-4 h-4 text-green-600" />, label: 'ok' };
    }
    if (isHealthy) {
      return { color: 'bg-yellow-50 border-yellow-200', icon: <AlertTriangle className="w-4 h-4 text-yellow-600" />, label: 'warning' };
    }
    return { color: 'bg-red-50 border-red-200', icon: <XCircle className="w-4 h-4 text-red-600" />, label: 'error' };
  };

  // Parse themes/articles from string
  const parseJsonArray = (val: string | null): string[] => {
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  };

  // Tribunals from stats
  const availableTribunals = stats?.byTribunal.map(t => t.tribunalCode) || [];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Scale className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Jurisprudencia de Tribunais</h1>
        </div>
        <p className="text-gray-600">
          Gerencie decisoes de Tribunais de Contas e Judiciais sobre licitacoes e contratos
        </p>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-6 border-l-4 border-l-blue-500">
            <div className="text-3xl font-bold text-blue-700">{stats.total}</div>
            <div className="text-sm text-gray-600">Total de decisoes</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6 border-l-4 border-l-yellow-500">
            <div className="text-3xl font-bold text-yellow-700">{stats.totalPending}</div>
            <div className="text-sm text-gray-600">Pendentes de revisao</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6 border-l-4 border-l-green-500">
            <div className="text-3xl font-bold text-green-700">{stats.totalApproved}</div>
            <div className="text-sm text-gray-600">Aprovadas</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6 border-l-4 border-l-red-500">
            <div className="text-3xl font-bold text-red-700">{stats.totalRejected}</div>
            <div className="text-sm text-gray-600">Rejeitadas</div>
          </div>
        </div>
      ) : null}

      {/* Stats by Tribunal */}
      {stats && stats.byTribunal.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {stats.byTribunal.map((t) => (
            <div key={t.tribunalCode} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tribunalColor(t.tribunalCode)}`}>
                  {t.tribunalCode}
                </span>
                <span className="text-2xl font-bold text-gray-900">{t.total}</span>
              </div>
              <div className="text-xs text-gray-500 truncate mb-1">{t.tribunalName}</div>
              <div className="flex gap-2 text-xs">
                <span className="text-yellow-600">{t.pending} pend.</span>
                <span className="text-green-600">{t.approved} aprov.</span>
                <span className="text-red-600">{t.rejected} rej.</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scraper Health */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Health dos Scrapers
        </h2>
        {scraperHealthLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-32 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-20" />
              </div>
            ))}
          </div>
        ) : scraperHealth.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scraperHealth.map((scraper) => {
              const badge = healthBadge(scraper.isHealthy, scraper.consecutiveFailures);
              const isRunning = runningScrapers.has(scraper.scraperCode);
              return (
                <div key={scraper.scraperCode} className={`bg-white rounded-lg shadow-sm border p-4 ${badge.color}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{scraper.scraperCode}</h3>
                      <span className="text-xs text-gray-500">{scraper.totalRuns} execucoes</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {badge.icon}
                      <span className="text-xs font-medium capitalize">{badge.label}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1 mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Ultimo run: {relativeTime(scraper.lastRun?.runAt || null)}
                    </div>
                    {scraper.lastRun && (
                      <div>
                        Encontrados: {scraper.lastRun.itemsFound} | Novos: {scraper.lastRun.itemsNew}
                        {scraper.lastRun.itemsError > 0 && <span className="text-red-600"> | Erros: {scraper.lastRun.itemsError}</span>}
                      </div>
                    )}
                    {scraper.consecutiveFailures > 0 && (
                      <div className="text-red-600">{scraper.consecutiveFailures} falha(s) consecutiva(s)</div>
                    )}
                    {scraper.lastRun?.errorMessage && (
                      <div className="text-red-600 text-xs mt-1">{scraper.lastRun.errorMessage}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRunScraper(scraper.scraperCode)}
                    disabled={isRunning}
                    className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Executando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Executar
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
            Nenhum scraper executado ainda. Execute manualmente para iniciar.
          </div>
        )}
      </div>

      {/* Review Queue */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Fila de Revisao
          </h2>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
            {[
              { key: 'pending' as const, label: 'Pendentes', count: stats?.totalPending },
              { key: 'auto_approved' as const, label: 'Auto-aprovados' },
              { key: 'manually_approved' as const, label: 'Aprovados' },
              { key: 'auto_rejected' as const, label: 'Auto-rejeitados' },
              { key: 'manually_rejected' as const, label: 'Rejeitados' },
              { key: 'all' as const, label: 'Todos', count: stats?.total },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label} {tab.count !== undefined && `(${tab.count})`}
              </button>
            ))}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterTribunal}
              onChange={(e) => setFilterTribunal(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="">Todos os tribunais</option>
              {availableTribunals.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar decisoes..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-20 bg-blue-600 text-white p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-medium text-sm">
                {selectedIds.size} selecionada(s)
              </span>
              <button onClick={toggleSelectAll} className="text-xs underline hover:text-blue-200">
                {selectedIds.size === decisions.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs underline hover:text-blue-200">
                Limpar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                disabled={isBulkProcessing}
                className="px-4 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isBulkProcessing ? 'Processando...' : 'Aprovar Selecionadas'}
              </button>
              <button
                onClick={handleBulkReject}
                disabled={isBulkProcessing}
                className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Rejeitar Selecionadas
              </button>
            </div>
          </div>
        )}

        {/* Decisions List */}
        <div className="divide-y">
          {decisionsLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-gray-500">Carregando decisoes...</p>
            </div>
          ) : decisions.length === 0 ? (
            <div className="p-12 text-center">
              <Scale className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">Nenhuma decisao encontrada</p>
              <p className="text-gray-400 text-sm mt-1">Tente ajustar os filtros selecionados</p>
            </div>
          ) : (
            <>
              {/* Select all header */}
              <div className="px-6 py-3 bg-gray-50 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === decisions.length && decisions.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  Mostrando {decisions.length} de {totalDecisions} decisao(oes)
                </span>
              </div>

              {decisions.map((decision) => {
                const isExpanded = expandedIds.has(decision.id);
                const themes = parseJsonArray(decision.themes);
                const articles = parseJsonArray(decision.leiArticles);
                return (
                  <div key={decision.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 pt-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(decision.id)}
                          onChange={() => toggleSelect(decision.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tribunalColor(decision.tribunalCode)}`}>
                            {decision.tribunalCode}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                            {decision.decisionType}
                          </span>
                          {decision.dataJulgamento && (
                            <span className="text-xs text-gray-500">
                              {new Date(decision.dataJulgamento).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            decision.relevanceScore >= 80 ? 'bg-green-100 text-green-800' :
                            decision.relevanceScore >= 50 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            Score: {decision.relevanceScore}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            decision.approvalStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            decision.approvalStatus.includes('approved') ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {decision.approvalStatus}
                          </span>
                        </div>

                        <h3 className="font-semibold text-gray-900 mb-1">
                          {decision.decisionNumber || decision.title}
                        </h3>

                        <p className="text-sm text-gray-600 mb-2 whitespace-pre-line">
                          {isExpanded
                            ? decision.ementa
                            : decision.ementa.length > 300
                              ? decision.ementa.substring(0, 300) + '...'
                              : decision.ementa
                          }
                        </p>

                        {(decision.ementa.length > 200 || decision.fullText) && (
                          <button
                            onClick={() => toggleExpand(decision.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2"
                          >
                            {isExpanded ? (
                              <><ChevronUp className="w-3 h-3" /> Menos</>
                            ) : (
                              <><FileText className="w-3 h-3" /> {decision.fullText ? 'Ver Inteiro Teor' : 'Mais'}</>
                            )}
                          </button>
                        )}

                        {/* Full text when expanded */}
                        {isExpanded && decision.fullText && decision.fullText !== decision.ementa && (
                          <div className="bg-gray-50 border rounded-lg p-3 mb-2 max-h-96 overflow-y-auto">
                            <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> Inteiro Teor
                            </p>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{decision.fullText}</p>
                          </div>
                        )}

                        {/* AI Summary */}
                        {decision.summary && (
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-2">
                            <p className="text-xs font-semibold text-blue-600 mb-0.5 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Resumo IA
                            </p>
                            <p className="text-xs text-blue-800">{decision.summary}</p>
                          </div>
                        )}

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                          {decision.relator && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {decision.relator}
                            </span>
                          )}
                          {decision.orgaoJulgador && (
                            <span>| {decision.orgaoJulgador}</span>
                          )}
                        </div>

                        {/* Themes */}
                        {themes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {themes.map((theme, i) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                                {theme}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Article references */}
                        {articles.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {articles.map((art, i) => (
                              <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                                Art. {art}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-2">
                          {decision.approvalStatus === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(decision.id)}
                                className="px-3 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3" /> Aprovar
                              </button>
                              <button
                                onClick={() => handleReject(decision.id)}
                                className="px-3 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-colors flex items-center gap-1"
                              >
                                <XCircle className="w-3 h-3" /> Rejeitar
                              </button>
                            </>
                          )}
                          {decision.url && (
                            <a
                              href={decision.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Ver Original
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Pagina {currentPage} de {totalPages} ({totalDecisions} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 border rounded-lg text-sm ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
