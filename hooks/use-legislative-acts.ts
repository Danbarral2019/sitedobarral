import { useState, useEffect, useCallback } from 'react';
import type { LegislativeAct, TabType } from '../components/LegislativeActsPanel/constants';

export function useLegislativeActs() {
  const [acts, setActs] = useState<LegislativeAct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Abas
  const [activeTab, setActiveTab] = useState<TabType>('atos');
  const [tabCounts, setTabCounts] = useState({ atos: 0, boasPraticas: 0 });

  // Filtros disponíveis
  const [availableTypes, setAvailableTypes] = useState<Array<{ type: string; count: number }>>([]);
  const [availableIssuers, setAvailableIssuers] = useState<Array<{ issuer: string; count: number }>>([]);
  const [availableYears, setAvailableYears] = useState<Array<{ year: number; count: number }>>([]);
  const [availableEsferas, setAvailableEsferas] = useState<Array<{ esfera: string; count: number }>>([]);

  // Filtros ativos
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [issuerFilter, setIssuerFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [esferaFilter, setEsferaFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState('');

  // Paginação
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 10;

  // UI
  const [showFilters, setShowFilters] = useState(false);
  const [expandedAct, setExpandedAct] = useState<string | null>(null);

  const isBoasPraticas = activeTab === 'boas-praticas';
  const hasActiveFilters = search || selectedType || issuerFilter || yearFilter || esferaFilter || themeFilter;

  // Buscar contagens das abas
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [atosRes, bpRes] = await Promise.all([
          fetch('/api/legislative-acts?tab=atos&limit=1'),
          fetch('/api/legislative-acts?tab=boas-praticas&limit=1'),
        ]);
        if (atosRes.ok) {
          const data = await atosRes.json();
          setTabCounts(prev => ({ ...prev, atos: data.pagination?.total || data.acts?.length || 0 }));
        }
        if (bpRes.ok) {
          const data = await bpRes.json();
          setTabCounts(prev => ({ ...prev, boasPraticas: data.pagination?.total || data.acts?.length || 0 }));
        }
      } catch {
        // Silently fail
      }
    };
    fetchCounts();
  }, []);

  const fetchActs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (search.trim()) params.set('search', search.trim());
      if (selectedType) params.set('type', selectedType);
      if (issuerFilter) params.set('issuer', issuerFilter);
      if (yearFilter) params.set('year', yearFilter);
      if (esferaFilter) params.set('esfera', esferaFilter);
      if (themeFilter) params.set('theme', themeFilter);

      const response = await fetch(`/api/legislative-acts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setActs(data.acts || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.pages || 1);
        setAvailableTypes(data.filters?.types || []);
        setAvailableIssuers(data.filters?.issuers || []);
        setAvailableYears(data.filters?.years || []);
        setAvailableEsferas(data.filters?.esferas || []);
      }
    } catch (error) {
      console.error('Erro ao buscar atos normativos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedType, issuerFilter, yearFilter, esferaFilter, themeFilter, activeTab, page]);

  useEffect(() => {
    const timer = setTimeout(fetchActs, 300);
    return () => clearTimeout(timer);
  }, [fetchActs]);

  const clearFilters = () => {
    setSearch('');
    setSelectedType('');
    setIssuerFilter('');
    setYearFilter('');
    setEsferaFilter('');
    setThemeFilter('');
    setPage(1);
  };

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    clearFilters();
    setExpandedAct(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return {
    acts,
    isLoading,
    activeTab,
    tabCounts,
    availableTypes,
    availableIssuers,
    availableYears,
    availableEsferas,
    search,
    setSearch,
    selectedType,
    setSelectedType,
    issuerFilter,
    setIssuerFilter,
    yearFilter,
    setYearFilter,
    esferaFilter,
    setEsferaFilter,
    themeFilter,
    setThemeFilter,
    page,
    setPage,
    total,
    totalPages,
    showFilters,
    setShowFilters,
    expandedAct,
    setExpandedAct,
    isBoasPraticas,
    hasActiveFilters,
    clearFilters,
    switchTab,
    formatDate,
  };
}
