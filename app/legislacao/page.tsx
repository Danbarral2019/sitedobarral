'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Scale, Calendar, Building, ChevronDown,
  ChevronUp, ExternalLink, Download, BookOpen, Eye,
  X, FileText, Globe, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import MarkdownContent from '@/components/MarkdownContent';
import { TEMAS_LICITACOES, getThemeLabel } from '@/data/temas-licitacoes';

interface LegislativeAct {
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

type TabType = 'atos' | 'boas-praticas';

const TYPE_LABELS: Record<string, string> = {
  'decreto': 'Decreto',
  'portaria': 'Portaria',
  'in': 'IN',
  'ordem-servico': 'Ordem de Serviço',
  'lei': 'Lei',
  'medida-provisoria': 'Medida Provisória',
  'boa_pratica': 'Outro Ato Normativo',
};

const TYPE_COLORS: Record<string, string> = {
  'decreto': 'bg-blue-100 text-blue-800 border-blue-300',
  'portaria': 'bg-green-100 text-green-800 border-green-300',
  'in': 'bg-purple-100 text-purple-800 border-purple-300',
  'ordem-servico': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'lei': 'bg-red-100 text-red-800 border-red-300',
  'medida-provisoria': 'bg-orange-100 text-orange-800 border-orange-300',
  'boa_pratica': 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const ESFERA_LABELS: Record<string, string> = {
  'federal': 'Federal',
  'estadual': 'Estadual',
};

export default function LegislacaoPage() {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [issuerFilter, setIssuerFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [esferaFilter, setEsferaFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState('');

  // Paginação
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 10;

  // UI state
  const [expandedAct, setExpandedAct] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Expandir automaticamente ato baseado no hash da URL
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash && acts.length > 0) {
      const actExists = acts.find(act => act.id === hash);
      if (actExists) {
        setExpandedAct(hash);
        setTimeout(() => {
          const element = document.getElementById(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  }, [acts]);

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
          setTabCounts(prev => ({ ...prev, atos: data.pagination.total }));
        }
        if (bpRes.ok) {
          const data = await bpRes.json();
          setTabCounts(prev => ({ ...prev, boasPraticas: data.pagination.total }));
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
      if (typeFilter) params.set('type', typeFilter);
      if (issuerFilter) params.set('issuer', issuerFilter);
      if (yearFilter) params.set('year', yearFilter);
      if (searchTerm) params.set('search', searchTerm);
      if (esferaFilter) params.set('esfera', esferaFilter);
      if (themeFilter) params.set('theme', themeFilter);

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
  }, [page, limit, typeFilter, issuerFilter, yearFilter, searchTerm, activeTab, esferaFilter, themeFilter]);

  useEffect(() => {
    fetchActs();
  }, [fetchActs]);

  const toggleExpand = (actId: string) => {
    setExpandedAct(expandedAct === actId ? null : actId);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const clearFilters = () => {
    setTypeFilter('');
    setIssuerFilter('');
    setYearFilter('');
    setSearchTerm('');
    setEsferaFilter('');
    setThemeFilter('');
    setPage(1);
  };

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setTypeFilter('');
    setIssuerFilter('');
    setYearFilter('');
    setEsferaFilter('');
    setThemeFilter('');
    setSearchTerm('');
    setExpandedAct(null);
  };

  const hasActiveFilters = typeFilter || issuerFilter || yearFilter || searchTerm || esferaFilter || themeFilter;
  const isBoasPraticas = activeTab === 'boas-praticas';

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Hero Section */}
        <section className={`bg-gradient-to-r ${isBoasPraticas ? 'from-emerald-600 to-teal-700' : 'from-blue-600 to-indigo-700'} text-white py-16 transition-colors duration-300`}>
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                {isBoasPraticas ? <FileText className="w-10 h-10 text-white" /> : <Scale className="w-10 h-10 text-white" />}
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">
                  {isBoasPraticas ? 'Outros Atos Normativos' : 'Atos Normativos'}
                </h1>
                <p className={`text-xl ${isBoasPraticas ? 'text-emerald-100' : 'text-blue-100'}`}>
                  {isBoasPraticas
                    ? 'Outros atos normativos relacionados a licitações e contratos'
                    : 'Legislação Relacionada à Lei 14.133/2021'}
                </p>
              </div>
            </div>
            <p className={`text-lg ${isBoasPraticas ? 'text-emerald-100' : 'text-blue-100'} max-w-3xl`}>
              {isBoasPraticas
                ? 'Explore outros atos normativos de órgãos federais e estaduais relacionados a licitações e contratos administrativos.'
                : 'Explore decretos, portarias, instruções normativas e demais atos que regulamentam a Lei de Licitações e Contratos Administrativos.'}
            </p>
          </div>
        </section>

        {/* Abas */}
        <section className="container mx-auto px-4 max-w-6xl -mt-6">
          <div className="flex gap-2">
            <button
              onClick={() => switchTab('atos')}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-colors ${
                activeTab === 'atos'
                  ? 'bg-white text-blue-700 border-2 border-b-0 border-gray-200 shadow-sm'
                  : 'bg-white/70 text-gray-600 hover:text-blue-700 hover:bg-white/90 border-2 border-transparent'
              }`}
            >
              <Scale className="w-4 h-4" />
              Atos Normativos
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'atos' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tabCounts.atos}
              </span>
            </button>
            <button
              onClick={() => switchTab('boas-praticas')}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-colors ${
                activeTab === 'boas-praticas'
                  ? 'bg-white text-emerald-700 border-2 border-b-0 border-gray-200 shadow-sm'
                  : 'bg-white/70 text-gray-600 hover:text-emerald-700 hover:bg-white/90 border-2 border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" />
              Outros Atos Normativos
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'boas-praticas' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tabCounts.boasPraticas}
              </span>
            </button>
          </div>
        </section>

        {/* Highlight Card — Lei 14.133 Comentada */}
        <section className="container mx-auto px-4 max-w-6xl mt-8">
          <Link href="/busca" className="block group">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-600 p-8 md:p-10 shadow-lg hover:shadow-2xl transition-all border-2 border-brand-500/30">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0yNCAzOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-9 h-9 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">
                    Lei 14.133/2021 — Comentada
                  </h2>
                  <p className="text-lg text-white/80">
                    195 artigos com jurisprudência e doutrina
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 bg-white text-brand-700 px-8 py-4 rounded-xl text-lg font-bold group-hover:bg-gray-50 transition-colors shadow-lg flex-shrink-0">
                  Pesquisar na Lei
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </Link>
        </section>

        {/* Conteúdo Principal */}
        <section className="container mx-auto px-4 max-w-6xl py-8">
          {/* Toolbar de Busca e Filtros */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              {/* Busca */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={isBoasPraticas
                    ? 'Buscar por título ou descrição...'
                    : 'Buscar por número, título ou assunto...'}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
              </div>

              {/* Botão de Filtros */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <Filter className="w-5 h-5" />
                <span className="font-semibold">Filtros</span>
                {hasActiveFilters && (
                  <span className="ml-2 w-2 h-2 bg-blue-600 rounded-full"></span>
                )}
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Painel de Filtros */}
            {showFilters && (
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                {/* Linha de dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Filtro por Tipo (apenas atos) */}
                  {!isBoasPraticas && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Tipo de Ato
                      </label>
                      <select
                        value={typeFilter}
                        onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {availableTypes.map(({ type, count }) => (
                          <option key={type} value={type}>
                            {TYPE_LABELS[type] || type} ({count})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Filtro por Órgão */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      {isBoasPraticas ? 'Órgão de Origem' : 'Órgão Emissor'}
                    </label>
                    {isBoasPraticas ? (
                      <input
                        type="text"
                        value={issuerFilter}
                        onChange={(e) => { setIssuerFilter(e.target.value); setPage(1); }}
                        placeholder="Ex: TCE-SP, CGE-MG..."
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        list="issuers-list"
                      />
                    ) : (
                      <select
                        value={issuerFilter}
                        onChange={(e) => { setIssuerFilter(e.target.value); setPage(1); }}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Todos</option>
                        {availableIssuers.map(({ issuer, count }) => (
                          <option key={issuer} value={issuer}>
                            {issuer} ({count})
                          </option>
                        ))}
                      </select>
                    )}
                    {isBoasPraticas && availableIssuers.length > 0 && (
                      <datalist id="issuers-list">
                        {availableIssuers.map(({ issuer }) => (
                          <option key={issuer} value={issuer} />
                        ))}
                      </datalist>
                    )}
                  </div>

                  {/* Filtro por Esfera */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Esfera
                    </label>
                    <select
                      value={esferaFilter}
                      onChange={(e) => { setEsferaFilter(e.target.value); setPage(1); }}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todas</option>
                      {availableEsferas.map(({ esfera, count }) => (
                        <option key={esfera} value={esfera}>
                          {ESFERA_LABELS[esfera] || esfera} ({count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por Ano */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Ano
                    </label>
                    <select
                      value={yearFilter}
                      onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {availableYears.map(({ year, count }) => (
                        <option key={year} value={year}>
                          {year} ({count})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Temas como chips */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Temas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TEMAS_LICITACOES.map((tema) => (
                      <button
                        key={tema.value}
                        onClick={() => {
                          setThemeFilter(themeFilter === tema.value ? '' : tema.value);
                          setPage(1);
                        }}
                        className={`px-3 py-1.5 text-xs rounded-full border-2 transition-colors font-medium ${
                          themeFilter === tema.value
                            ? isBoasPraticas
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {tema.label}
                      </button>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Limpar todos os filtros
                  </button>
                )}
              </div>
            )}

            {/* Chips de filtros ativos */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-sm font-semibold text-gray-600">Filtros:</span>
                {esferaFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200">
                    {ESFERA_LABELS[esferaFilter] || esferaFilter}
                    <button onClick={() => { setEsferaFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {typeFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm border border-purple-200">
                    {TYPE_LABELS[typeFilter] || typeFilter}
                    <button onClick={() => { setTypeFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {issuerFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm border border-green-200">
                    {issuerFilter}
                    <button onClick={() => { setIssuerFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {yearFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm border border-orange-200">
                    {yearFilter}
                    <button onClick={() => { setYearFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {themeFilter && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm border border-indigo-200">
                    {getThemeLabel(themeFilter)}
                    <button onClick={() => { setThemeFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm border border-gray-200">
                    &quot;{searchTerm}&quot;
                    <button onClick={() => { setSearchTerm(''); setPage(1); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-500 hover:text-red-600 underline ml-2"
                >
                  Limpar todos
                </button>
              </div>
            )}
          </div>

          {/* Lista de Atos */}
          {isLoading ? (
            <div className="text-center py-16">
              <div className={`inline-block w-12 h-12 border-4 ${isBoasPraticas ? 'border-emerald-600' : 'border-blue-600'} border-t-transparent rounded-full animate-spin`}></div>
              <p className="mt-4 text-gray-600 text-lg">
                {isBoasPraticas ? 'Carregando outros atos normativos...' : 'Carregando legislação...'}
              </p>
            </div>
          ) : acts.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-gray-200">
              {isBoasPraticas ? (
                <>
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum ato normativo encontrado</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    {hasActiveFilters
                      ? 'Tente ajustar os filtros ou fazer uma nova busca.'
                      : 'Outros atos normativos de órgãos federais e estaduais são adicionados regularmente.'}
                  </p>
                </>
              ) : (
                <>
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum ato encontrado</h3>
                  <p className="text-gray-600">
                    {hasActiveFilters
                      ? 'Tente ajustar os filtros ou fazer uma nova busca.'
                      : 'Não há atos normativos cadastrados no momento.'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Info de Resultados */}
              <div className="mb-6 flex items-center justify-between">
                <p className="text-gray-600">
                  Mostrando <span className="font-semibold">{acts.length}</span> de{' '}
                  <span className="font-semibold">{total}</span> {isBoasPraticas ? 'outros atos normativos' : 'atos normativos'}
                </p>
                <p className="text-sm text-gray-500">
                  Página {page} de {totalPages}
                </p>
              </div>

              {/* Cards */}
              <div className="space-y-4">
                {acts.map(act => (
                  <article
                    key={act.id}
                    id={act.id}
                    className={`bg-white border-2 rounded-xl overflow-hidden transition-all ${
                      isBoasPraticas
                        ? 'border-gray-200 hover:border-emerald-300 hover:shadow-lg'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-lg'
                    }`}
                  >
                    {/* Header do Card */}
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          {/* Tags e Meta */}
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`px-3 py-1 text-sm font-bold rounded-lg border-2 ${TYPE_COLORS[act.type] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                              {TYPE_LABELS[act.type] || act.type}
                            </span>
                            {act.esfera && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded border flex items-center gap-1 bg-gray-100 text-gray-700 border-gray-300">
                                <Globe className="w-3 h-3" />
                                {ESFERA_LABELS[act.esfera] || act.esfera}
                              </span>
                            )}
                            {act.fullNumber && (
                              <Link
                                href={`/legislacao/${act.id}`}
                                className="text-lg font-mono font-bold text-gray-900 hover:text-blue-700 transition-colors"
                              >
                                {act.fullNumber}
                              </Link>
                            )}
                          </div>

                          {/* Título */}
                          <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                            <Link
                              href={`/legislacao/${act.id}`}
                              className="hover:text-blue-700 transition-colors"
                            >
                              {act.title}
                            </Link>
                          </h2>

                          {/* Ementa */}
                          <p className="text-gray-700 leading-relaxed mb-4">
                            {act.ementa}
                          </p>

                          {/* Metadados */}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <Building className="w-4 h-4" />
                              {act.issuer}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              {formatDate(act.publishDate)}
                            </div>
                            {act.viewCount !== undefined && (
                              <div className="flex items-center gap-1.5">
                                <Eye className="w-4 h-4" />
                                {act.viewCount} visualizações
                              </div>
                            )}
                          </div>

                          {/* Temas mini-pills */}
                          {act.themes && act.themes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {act.themes.map(t => (
                                <span
                                  key={t}
                                  className={`px-2 py-0.5 text-xs rounded-full ${
                                    isBoasPraticas
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  }`}
                                >
                                  {getThemeLabel(t)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Botão Expandir */}
                        <button
                          onClick={() => toggleExpand(act.id)}
                          className="flex-shrink-0 p-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Ver mais detalhes"
                        >
                          {expandedAct === act.id ? (
                            <ChevronUp className="w-6 h-6" />
                          ) : (
                            <ChevronDown className="w-6 h-6" />
                          )}
                        </button>
                      </div>

                      {/* Artigos Relacionados (Preview) */}
                      {act.leiArticles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                            <Scale className="w-4 h-4" />
                            Artigos:
                          </span>
                          {act.leiArticles.slice(0, 5).map(art => (
                            <span
                              key={art}
                              className="px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-semibold rounded border border-blue-200"
                            >
                              Art. {art}
                            </span>
                          ))}
                          {act.leiArticles.length > 5 && (
                            <span className="text-xs text-gray-500">
                              +{act.leiArticles.length - 5} artigos
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Detalhes Expandidos */}
                    {expandedAct === act.id && (
                      <div className="border-t-2 border-gray-200 bg-gray-50 p-6">
                        {act.summary && (
                          <div className={`mb-6 rounded-xl overflow-hidden shadow-sm ${
                            isBoasPraticas
                              ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50'
                              : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
                          }`}>
                            <div className={`px-4 py-3 ${
                              isBoasPraticas
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                            }`}>
                              <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wide">
                                <BookOpen className="w-5 h-5" />
                                Resumo Didático
                              </h3>
                            </div>
                            <div className="p-4">
                              <MarkdownContent content={act.summary} />
                            </div>
                          </div>
                        )}

                        {/* Todos os Artigos */}
                        {act.leiArticles.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                              Artigos Regulamentados da Lei 14.133/2021
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {act.leiArticles.map(art => (
                                <span
                                  key={art}
                                  className="px-3 py-1.5 bg-blue-100 text-blue-900 text-sm font-semibold rounded-lg border-2 border-blue-300"
                                >
                                  Art. {art}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Links */}
                        <div className="flex flex-wrap gap-3">
                          {act.officialUrl && (
                            <a
                              href={act.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 px-4 py-2.5 text-white rounded-lg transition-colors font-semibold ${
                                isBoasPraticas
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              <ExternalLink className="w-5 h-5" />
                              {isBoasPraticas ? 'Ver Fonte Original' : 'Ver Texto Oficial'}
                            </a>
                          )}
                          {act.pdfUrl && (
                            <a
                              href={act.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                            >
                              <Download className="w-5 h-5" />
                              Download PDF
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    ← Anterior
                  </button>

                  <span className="px-6 py-3 text-gray-700 font-semibold">
                    {page} / {totalPages}
                  </span>

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    Próxima →
                  </button>
                </div>
              )}
            </>
          )}
        </section>
    </main>
  );
}
