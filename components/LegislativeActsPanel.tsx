'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Gavel, FileText, ExternalLink, Loader2, Search, X,
  Scale, Lightbulb, Globe, Filter, ChevronDown, ChevronUp,
  Building, Calendar, BookOpen, Download,
} from 'lucide-react';
import Link from 'next/link';
import { TEMAS_LICITACOES, getThemeLabel } from '@/data/temas-licitacoes';
import MarkdownContent from '@/components/MarkdownContent';

type LegislativeAct = {
  id: string;
  type: string;
  fullNumber?: string;
  title: string;
  ementa: string;
  summary?: string | null;
  issuer: string;
  publishDate: string;
  hierarchyLevel: number;
  leiArticles: string[];
  officialUrl?: string | null;
  pdfUrl?: string | null;
  esfera?: string;
  themes?: string[];
  url?: string;
};

type TabType = 'atos' | 'boas-praticas';

const TYPE_LABELS: Record<string, string> = {
  decreto: 'Decreto',
  portaria: 'Portaria',
  in: 'Instrução Normativa',
  'ordem-servico': 'Ordem de Serviço',
  lei: 'Lei',
  'medida-provisoria': 'Medida Provisória',
  boa_pratica: 'Boa Prática',
};

const TYPE_COLORS: Record<string, string> = {
  decreto: 'bg-blue-100 text-blue-800',
  portaria: 'bg-green-100 text-green-800',
  in: 'bg-purple-100 text-purple-800',
  'ordem-servico': 'bg-yellow-100 text-yellow-800',
  lei: 'bg-red-100 text-red-800',
  'medida-provisoria': 'bg-orange-100 text-orange-800',
  boa_pratica: 'bg-emerald-100 text-emerald-800',
};

const ESFERA_LABELS: Record<string, string> = {
  federal: 'Federal',
  estadual: 'Estadual',
};

export default function LegislativeActsPanel() {
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

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Header com Abas */}
      <div className="p-6 pb-0">
        <div className="flex items-center gap-3 mb-4">
          {isBoasPraticas
            ? <Lightbulb className="w-8 h-8 text-emerald-600" />
            : <Gavel className="w-8 h-8 text-amber-600" />
          }
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {isBoasPraticas ? 'Boas Práticas' : 'Atos Normativos Infralegais'}
            </h2>
            <p className="text-sm text-gray-600">
              {isBoasPraticas
                ? 'Referências de outros órgãos para licitações e contratos'
                : 'Decretos, portarias e instruções normativas que regulamentam a Lei 14.133/2021'}
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b-2 border-gray-200">
          <button
            onClick={() => switchTab('atos')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm transition-colors -mb-[2px] border-b-2 ${
              activeTab === 'atos'
                ? 'text-amber-700 border-amber-600'
                : 'text-gray-500 border-transparent hover:text-amber-600'
            }`}
          >
            <Scale className="w-4 h-4" />
            Atos Normativos
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'atos' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {tabCounts.atos}
            </span>
          </button>
          <button
            onClick={() => switchTab('boas-praticas')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm transition-colors -mb-[2px] border-b-2 ${
              activeTab === 'boas-praticas'
                ? 'text-emerald-700 border-emerald-600'
                : 'text-gray-500 border-transparent hover:text-emerald-600'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            Boas Práticas
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'boas-praticas' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {tabCounts.boasPraticas}
            </span>
          </button>
        </div>
      </div>

      {/* Busca + Filtros */}
      <div className="p-6">
        {/* Busca */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={isBoasPraticas
                ? 'Buscar por título ou descrição...'
                : 'Buscar por título, número ou ementa...'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-10 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 transition-colors"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-2 rounded-xl text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? isBoasPraticas
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className={`w-2 h-2 rounded-full ${isBoasPraticas ? 'bg-emerald-600' : 'bg-amber-600'}`} />
            )}
          </button>
        </div>

        {/* Painel de Filtros Expandido */}
        {showFilters && (
          <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-3 space-y-3">
            {/* Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Tipo (apenas atos) */}
              {!isBoasPraticas && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Tipo</label>
                  <select
                    value={selectedType}
                    onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
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

              {/* Órgão */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  {isBoasPraticas ? 'Órgão de Origem' : 'Órgão Emissor'}
                </label>
                {isBoasPraticas ? (
                  <input
                    type="text"
                    value={issuerFilter}
                    onChange={(e) => { setIssuerFilter(e.target.value); setPage(1); }}
                    placeholder="Ex: TCE-SP..."
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                    list="panel-issuers-list"
                  />
                ) : (
                  <select
                    value={issuerFilter}
                    onChange={(e) => { setIssuerFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
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
                  <datalist id="panel-issuers-list">
                    {availableIssuers.map(({ issuer }) => (
                      <option key={issuer} value={issuer} />
                    ))}
                  </datalist>
                )}
              </div>

              {/* Esfera */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Esfera</label>
                <select
                  value={esferaFilter}
                  onChange={(e) => { setEsferaFilter(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
                >
                  <option value="">Todas</option>
                  {availableEsferas.map(({ esfera, count }) => (
                    <option key={esfera} value={esfera}>
                      {ESFERA_LABELS[esfera] || esfera} ({count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ano */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Ano</label>
                <select
                  value={yearFilter}
                  onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-400"
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
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Temas</label>
              <div className="flex flex-wrap gap-1.5">
                {TEMAS_LICITACOES.map((tema) => (
                  <button
                    key={tema.value}
                    onClick={() => {
                      setThemeFilter(themeFilter === tema.value ? '' : tema.value);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors font-medium ${
                      themeFilter === tema.value
                        ? isBoasPraticas
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {tema.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chips de filtros ativos */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="text-xs font-semibold text-gray-500">Filtros:</span>
            {esferaFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                {ESFERA_LABELS[esferaFilter] || esferaFilter}
                <button onClick={() => { setEsferaFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs border border-purple-200">
                {TYPE_LABELS[selectedType] || selectedType}
                <button onClick={() => { setSelectedType(''); setPage(1); }}><X className="w-3 h-3" /></button>
              </span>
            )}
            {issuerFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs border border-green-200">
                {issuerFilter}
                <button onClick={() => { setIssuerFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
              </span>
            )}
            {yearFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs border border-orange-200">
                {yearFilter}
                <button onClick={() => { setYearFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
              </span>
            )}
            {themeFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs border border-indigo-200">
                {getThemeLabel(themeFilter)}
                <button onClick={() => { setThemeFilter(''); setPage(1); }}><X className="w-3 h-3" /></button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs border border-gray-200">
                &quot;{search}&quot;
                <button onClick={() => { setSearch(''); setPage(1); }}><X className="w-3 h-3" /></button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-red-600 underline ml-1"
            >
              Limpar
            </button>
          </div>
        )}

        {/* Count */}
        {!isLoading && (
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              {total} {isBoasPraticas
                ? (total === 1 ? 'boa prática' : 'boas práticas')
                : (total === 1 ? 'ato normativo' : 'atos normativos')}
              {hasActiveFilters && ' encontrado(s)'}
            </span>
            {totalPages > 1 && (
              <span className="text-xs text-gray-500">
                Pág. {page}/{totalPages}
              </span>
            )}
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-8 h-8 animate-spin ${isBoasPraticas ? 'text-emerald-600' : 'text-amber-600'}`} />
          </div>
        ) : acts.length === 0 ? (
          /* Empty state */
          <div className="text-center py-12">
            {isBoasPraticas ? (
              <>
                <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhuma boa prática encontrada</p>
                <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'Tente ajustar os filtros ou busca.'
                    : 'Boas práticas são atos de outros órgãos que servem como referência. Novos documentos são adicionados regularmente.'}
                </p>
              </>
            ) : (
              <>
                <Gavel className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhum ato normativo encontrado.</p>
              </>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className={`mt-3 text-sm font-medium ${isBoasPraticas ? 'text-emerald-600 hover:text-emerald-700' : 'text-amber-600 hover:text-amber-700'}`}
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          /* Acts list */
          <div className="space-y-3">
            {acts.map((act) => (
              <div
                key={act.id}
                className={`border-2 rounded-xl overflow-hidden transition-all ${
                  isBoasPraticas
                    ? 'border-gray-200 hover:border-emerald-300'
                    : 'border-gray-200 hover:border-amber-300'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${TYPE_COLORS[act.type] || 'bg-gray-100 text-gray-800'}`}>
                          {TYPE_LABELS[act.type] || act.type}
                        </span>
                        {act.esfera && (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded border flex items-center gap-0.5 bg-gray-50 text-gray-600 border-gray-200">
                            <Globe className="w-3 h-3" />
                            {ESFERA_LABELS[act.esfera] || act.esfera}
                          </span>
                        )}
                        {act.fullNumber && (
                          <Link
                            href={`/legislacao/${act.id}`}
                            className="text-sm font-mono font-bold text-gray-900 hover:text-amber-700 transition-colors"
                          >
                            {act.fullNumber}
                          </Link>
                        )}
                      </div>

                      {/* Título */}
                      <h3 className="font-bold text-gray-900 text-base leading-tight">
                        <Link
                          href={`/legislacao/${act.id}`}
                          className="hover:text-amber-700 transition-colors"
                        >
                          {act.title}
                        </Link>
                      </h3>

                      {/* Ementa */}
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {act.ementa}
                      </p>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5" />
                          {act.issuer}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(act.publishDate)}
                        </span>
                        {act.leiArticles && act.leiArticles.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                            Art. {act.leiArticles.slice(0, 4).join(', ')}{act.leiArticles.length > 4 ? '...' : ''}
                          </span>
                        )}
                      </div>

                      {/* Temas mini-pills */}
                      {act.themes && act.themes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
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

                    {/* Expand + Links */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setExpandedAct(expandedAct === act.id ? null : act.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Ver detalhes"
                      >
                        {expandedAct === act.id
                          ? <ChevronUp className="w-5 h-5" />
                          : <ChevronDown className="w-5 h-5" />}
                      </button>
                      {(act.officialUrl || act.url) && (
                        <a
                          href={act.officialUrl || act.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            isBoasPraticas
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Texto
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detalhes Expandidos */}
                {expandedAct === act.id && (
                  <div className="border-t-2 border-gray-100 bg-gray-50 p-4">
                    {/* Resumo Didático */}
                    {act.summary && (
                      <div className={`mb-4 rounded-lg overflow-hidden ${
                        isBoasPraticas ? 'bg-emerald-50' : 'bg-blue-50'
                      }`}>
                        <div className={`px-3 py-2 ${
                          isBoasPraticas
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                        }`}>
                          <h4 className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wide">
                            <BookOpen className="w-4 h-4" />
                            Resumo Didático
                          </h4>
                        </div>
                        <div className="p-3 text-sm">
                          <MarkdownContent content={act.summary} />
                        </div>
                      </div>
                    )}

                    {/* Artigos */}
                    {act.leiArticles && act.leiArticles.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                          Artigos da Lei 14.133/2021
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {act.leiArticles.map(art => (
                            <span
                              key={art}
                              className="px-2.5 py-1 bg-blue-100 text-blue-900 text-xs font-semibold rounded-lg border border-blue-300"
                            >
                              Art. {art}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Links */}
                    <div className="flex flex-wrap gap-2">
                      {act.officialUrl && (
                        <a
                          href={act.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg transition-colors ${
                            isBoasPraticas
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          {isBoasPraticas ? 'Ver Fonte Original' : 'Ver Texto Oficial'}
                        </a>
                      )}
                      {act.url && act.url !== act.officialUrl && (
                        <a
                          href={act.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Link DOU
                        </a>
                      )}
                      {act.pdfUrl && (
                        <a
                          href={act.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {!isLoading && totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Anterior
            </button>
            <span className="px-3 py-2 text-sm text-gray-600 font-medium">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
