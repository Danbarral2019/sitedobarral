'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { isValidSort } from '@/lib/legislacao/labels';
import type { LegislacaoTab } from '@/lib/legislacao/theme';

export interface LegislativeAct {
  id: string;
  type: string;
  number?: string;
  year?: number;
  fullNumber?: string;
  title: string;
  ementa: string;
  summary?: string | null;
  issuer: string;
  publishDate: string;
  effectiveDate?: string | null;
  hierarchyLevel?: number;
  leiArticles: string[];
  officialUrl: string | null;
  pdfUrl?: string | null;
  viewCount?: number;
  esfera?: string;
  themes?: string[];
  url?: string;
}

export interface TabCounts {
  atos: number;
  boasPraticas: number;
  tic: number;
  orientacoes: number;
}

const LIMIT = 10;

export function useLegislacao() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [acts, setActs] = useState<LegislativeAct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<LegislacaoTab>('atos');
  const [tabCounts, setTabCounts] = useState<TabCounts>({ atos: 0, boasPraticas: 0, tic: 0, orientacoes: 0 });

  const [availableTypes, setAvailableTypes] = useState<Array<{ type: string; count: number }>>([]);
  const [availableIssuers, setAvailableIssuers] = useState<Array<{ issuer: string; count: number }>>([]);
  const [availableYears, setAvailableYears] = useState<Array<{ year: number; count: number }>>([]);
  const [availableEsferas, setAvailableEsferas] = useState<Array<{ esfera: string; count: number }>>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [issuerFilter, setIssuerFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [esferaFilter, setEsferaFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState('');

  const initialSort = (() => {
    const fromUrl = searchParams.get('sort');
    return isValidSort(fromUrl) ? (fromUrl as string) : 'recent';
  })();
  const [sortFilter, setSortFilter] = useState(initialSort);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (sortFilter === 'recent') {
      params.delete('sort');
    } else {
      params.set('sort', sortFilter);
    }
    const qs = params.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortFilter]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [expandedAct, setExpandedAct] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash && acts.length > 0) {
      const actExists = acts.find((act) => act.id === hash);
      if (actExists) {
        setExpandedAct(hash);
        setTimeout(() => {
          const element = document.getElementById(hash);
          if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    }
  }, [acts]);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [atosRes, bpRes, ticRes, oriRes] = await Promise.all([
          fetch('/api/legislative-acts?tab=atos&limit=1'),
          fetch('/api/legislative-acts?tab=boas-praticas&limit=1'),
          fetch('/api/legislative-acts?tab=tic&limit=1'),
          fetch('/api/legislative-acts?tab=orientacoes&limit=1'),
        ]);
        if (atosRes.ok) {
          const data = await atosRes.json();
          setTabCounts((prev) => ({ ...prev, atos: data.pagination.total }));
        }
        if (bpRes.ok) {
          const data = await bpRes.json();
          setTabCounts((prev) => ({ ...prev, boasPraticas: data.pagination.total }));
        }
        if (ticRes.ok) {
          const data = await ticRes.json();
          setTabCounts((prev) => ({ ...prev, tic: data.pagination.total }));
        }
        if (oriRes.ok) {
          const data = await oriRes.json();
          setTabCounts((prev) => ({ ...prev, orientacoes: data.pagination.total }));
        }
      } catch {
        // silently fail
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
      params.set('limit', LIMIT.toString());
      if (typeFilter) params.set('type', typeFilter);
      if (issuerFilter) params.set('issuer', issuerFilter);
      if (yearFilter) params.set('year', yearFilter);
      if (searchTerm) params.set('search', searchTerm);
      if (esferaFilter) params.set('esfera', esferaFilter);
      if (themeFilter) params.set('theme', themeFilter);
      if (sortFilter && sortFilter !== 'recent') params.set('sort', sortFilter);

      const response = await fetch(`/api/legislative-acts?${params}`);
      if (!response.ok) throw new Error('Erro ao carregar atos');

      const data = await response.json();
      setActs(data.acts);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);

      setAvailableTypes(data.filters.types || []);
      setAvailableIssuers(data.filters.issuers || []);
      setAvailableYears(data.filters.years || []);
      setAvailableEsferas(data.filters.esferas || []);
    } catch (error) {
      console.error('Erro ao carregar atos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, typeFilter, issuerFilter, yearFilter, searchTerm, activeTab, esferaFilter, themeFilter, sortFilter]);

  useEffect(() => {
    fetchActs();
  }, [fetchActs]);

  const toggleExpand = useCallback((actId: string) => {
    setExpandedAct((prev) => (prev === actId ? null : actId));
  }, []);

  const clearFilters = useCallback(() => {
    setTypeFilter('');
    setIssuerFilter('');
    setYearFilter('');
    setSearchTerm('');
    setEsferaFilter('');
    setThemeFilter('');
    setSortFilter('recent');
    setPage(1);
  }, []);

  const switchTab = useCallback((tab: LegislacaoTab) => {
    setActiveTab(tab);
    setPage(1);
    setTypeFilter('');
    setIssuerFilter('');
    setYearFilter('');
    setEsferaFilter('');
    setThemeFilter('');
    setSearchTerm('');
    setExpandedAct(null);
  }, []);

  // Resetam pra page 1 quando filter muda
  const wrapSetFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    typeFilter || issuerFilter || yearFilter || searchTerm || esferaFilter || themeFilter,
  );

  return {
    // Data
    acts,
    isLoading,
    total,
    totalPages,
    page,
    setPage,
    limit: LIMIT,

    // Tab
    activeTab,
    switchTab,
    tabCounts,

    // Filter options (from API)
    availableTypes,
    availableIssuers,
    availableYears,
    availableEsferas,

    // Active filters
    searchTerm,
    setSearchTerm: wrapSetFilter(setSearchTerm),
    typeFilter,
    setTypeFilter: wrapSetFilter(setTypeFilter),
    issuerFilter,
    setIssuerFilter: wrapSetFilter(setIssuerFilter),
    yearFilter,
    setYearFilter: wrapSetFilter(setYearFilter),
    esferaFilter,
    setEsferaFilter: wrapSetFilter(setEsferaFilter),
    themeFilter,
    setThemeFilter: wrapSetFilter(setThemeFilter),
    sortFilter,
    setSortFilter: wrapSetFilter(setSortFilter),
    hasActiveFilters,
    clearFilters,

    // UI state
    expandedAct,
    toggleExpand,
    showFilters,
    setShowFilters,
  };
}
