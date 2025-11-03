'use client';

import { useState, useEffect } from 'react';
import {
  Search, Filter, Scale, Calendar, Building, ChevronDown,
  ChevronUp, ExternalLink, Download, BookOpen, Eye,
  X, FileText
} from 'lucide-react';

interface LegislativeAct {
  id: string;
  type: string;
  number: string;
  year: number;
  fullNumber: string;
  title: string;
  ementa: string;
  summary: string | null;
  issuer: string;
  publishDate: string;
  effectiveDate: string | null;
  hierarchyLevel: number;
  leiArticles: string[];
  officialUrl: string | null;
  pdfUrl: string | null;
  viewCount: number;
}

const TYPE_LABELS: Record<string, string> = {
  'decreto': 'Decreto',
  'portaria': 'Portaria',
  'in': 'IN',
  'ordem-servico': 'Ordem de Serviço',
  'lei': 'Lei',
  'medida-provisoria': 'Medida Provisória'
};

const TYPE_COLORS: Record<string, string> = {
  'decreto': 'bg-blue-100 text-blue-800 border-blue-300',
  'portaria': 'bg-green-100 text-green-800 border-green-300',
  'in': 'bg-purple-100 text-purple-800 border-purple-300',
  'ordem-servico': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'lei': 'bg-red-100 text-red-800 border-red-300',
  'medida-provisoria': 'bg-orange-100 text-orange-800 border-orange-300'
};

export default function LegislacaoPage() {
  const [acts, setActs] = useState<LegislativeAct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros disponíveis
  const [availableTypes, setAvailableTypes] = useState<Array<{ type: string; count: number }>>([]);
  const [availableIssuers, setAvailableIssuers] = useState<Array<{ issuer: string; count: number }>>([]);
  const [availableYears, setAvailableYears] = useState<Array<{ year: number; count: number }>>([]);

  // Filtros ativos
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [issuerFilter, setIssuerFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Paginação
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 10;

  // UI state
  const [expandedAct, setExpandedAct] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchActs();
  }, [page, typeFilter, issuerFilter, yearFilter, searchTerm]);

  // Expandir automaticamente ato baseado no hash da URL
  useEffect(() => {
    const hash = window.location.hash.substring(1); // Remove o '#'
    if (hash && acts.length > 0) {
      const actExists = acts.find(act => act.id === hash);
      if (actExists) {
        setExpandedAct(hash);
        // Aguardar um pouco para garantir que o elemento foi renderizado
        setTimeout(() => {
          const element = document.getElementById(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  }, [acts]);

  const fetchActs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (typeFilter) params.set('type', typeFilter);
      if (issuerFilter) params.set('issuer', issuerFilter);
      if (yearFilter) params.set('year', yearFilter);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/legislative-acts?${params}`);
      if (!response.ok) throw new Error('Erro ao carregar atos');

      const data = await response.json();
      setActs(data.acts);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.pages);

      // Atualizar filtros disponíveis
      setAvailableTypes(data.filters.types || []);
      setAvailableIssuers(data.filters.issuers || []);
      setAvailableYears(data.filters.years || []);
    } catch (error) {
      console.error('Erro ao carregar atos:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
    setPage(1);
  };

  const hasActiveFilters = typeFilter || issuerFilter || yearFilter || searchTerm;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <Scale className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">Atos Normativos</h1>
                <p className="text-xl text-blue-100">
                  Legislação Relacionada à Lei 14.133/2021
                </p>
              </div>
            </div>
            <p className="text-lg text-blue-100 max-w-3xl">
              Explore decretos, portarias, instruções normativas e demais atos que regulamentam
              a Lei de Licitações e Contratos Administrativos.
            </p>
          </div>
        </section>

        {/* Conteúdo Principal */}
        <section className="container mx-auto px-4 max-w-6xl py-12">
          {/* Toolbar de Busca e Filtros */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              {/* Busca */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por número, título ou assunto..."
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
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Filtro por Tipo */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Tipo de Ato
                    </label>
                    <select
                      value={typeFilter}
                      onChange={(e) => {
                        setTypeFilter(e.target.value);
                        setPage(1);
                      }}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos ({total})</option>
                      {availableTypes.map(({ type, count }) => (
                        <option key={type} value={type}>
                          {TYPE_LABELS[type] || type} ({count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por Órgão */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Órgão Emissor
                    </label>
                    <select
                      value={issuerFilter}
                      onChange={(e) => {
                        setIssuerFilter(e.target.value);
                        setPage(1);
                      }}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {availableIssuers.map(({ issuer, count }) => (
                        <option key={issuer} value={issuer}>
                          {issuer} ({count})
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
                      onChange={(e) => {
                        setYearFilter(e.target.value);
                        setPage(1);
                      }}
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

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Limpar todos os filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Lista de Atos */}
          {isLoading ? (
            <div className="text-center py-16">
              <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600 text-lg">Carregando legislação...</p>
            </div>
          ) : acts.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-gray-200">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum ato encontrado</h3>
              <p className="text-gray-600">
                {hasActiveFilters
                  ? 'Tente ajustar os filtros ou fazer uma nova busca.'
                  : 'Não há atos normativos cadastrados no momento.'}
              </p>
            </div>
          ) : (
            <>
              {/* Info de Resultados */}
              <div className="mb-6 flex items-center justify-between">
                <p className="text-gray-600">
                  Mostrando <span className="font-semibold">{acts.length}</span> de{' '}
                  <span className="font-semibold">{total}</span> atos normativos
                </p>
                <p className="text-sm text-gray-500">
                  Página {page} de {totalPages}
                </p>
              </div>

              {/* Cards de Atos */}
              <div className="space-y-4">
                {acts.map(act => (
                  <article
                    key={act.id}
                    id={act.id}
                    className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all"
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
                            <span className="text-lg font-mono font-bold text-gray-900">
                              {act.fullNumber}
                            </span>
                          </div>

                          {/* Título */}
                          <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                            {act.title}
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
                            <div className="flex items-center gap-1.5">
                              <Eye className="w-4 h-4" />
                              {act.viewCount} visualizações
                            </div>
                          </div>
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
                          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <BookOpen className="w-5 h-5 text-blue-700" />
                              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">
                                Resumo Didático
                              </h3>
                            </div>
                            <p className="text-gray-800 leading-relaxed">{act.summary}</p>
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
                              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                            >
                              <ExternalLink className="w-5 h-5" />
                              Ver Texto Oficial
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
