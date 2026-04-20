'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Scale, Calendar, ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface Decision {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  title: string;
  ementa: string;
  summary: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: string | null;
  themes: string;
  leiArticles: string;
  url: string | null;
}

interface ApiResponse {
  items: Decision[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const TRIBUNALS = [
  { code: 'tce-sp', label: 'TCE-SP' },
  { code: 'tce-pr', label: 'TCE-PR' },
  { code: 'tce-sc', label: 'TCE-SC' },
  { code: 'tce-rj', label: 'TCE-RJ' },
  { code: 'tce-rs', label: 'TCE-RS' },
  { code: 'tce-pe', label: 'TCE-PE' },
  { code: 'datajud-stj', label: 'DataJud (STJ)' },
];

const COMMON_THEMES = [
  'Licitação',
  'Contratos Administrativos',
  'Pregão',
  'Dispensa/Inexigibilidade',
  'Fiscalização',
  'Sanção',
  'Planejamento',
];

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function tribunalLabel(code: string): string {
  return TRIBUNALS.find(t => t.code === code)?.label || code.toUpperCase();
}

function tribunalColor(code: string): string {
  const colors: Record<string, string> = {
    'tce-sp': 'bg-blue-100 text-blue-800',
    'tce-mg': 'bg-green-100 text-green-800',
    'tce-pr': 'bg-purple-100 text-purple-800',
    'tce-sc': 'bg-sky-100 text-sky-800',
    'tce-rj': 'bg-orange-100 text-orange-800',
    'tce-rs': 'bg-violet-100 text-violet-800',
    'tce-pe': 'bg-teal-100 text-teal-800',
    'datajud-stj': 'bg-red-100 text-red-800',
  };
  return colors[code] || 'bg-gray-100 text-gray-800';
}

export default function JurisprudenciaClient() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [tribunal, setTribunal] = useState('');
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');

  const pageSize = 12;
  const [currentYear] = useState(() => new Date().getFullYear());
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchDecisions = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (tribunal) params.set('tribunal', tribunal);
      if (year) params.set('ano', year);
      if (search) params.set('q', search);
      if (selectedTheme) params.set('tema', selectedTheme);

      const res = await fetch(`/api/jurisprudencia?${params}`);
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setDecisions(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch decisions:', err);
    } finally {
      setLoading(false);
    }
  }, [tribunal, year, search, selectedTheme]);

  // Fetch when page changes
  useEffect(() => {
    fetchDecisions(currentPage);
  }, [currentPage, fetchDecisions]);

  // Reset to page 1 when filters change (fetchDecisions dep change triggers the fetch above)
  useEffect(() => {
    setCurrentPage(1);
  }, [tribunal, year, search, selectedTheme]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="inline-flex p-3 bg-white/20 backdrop-blur-sm rounded-xl mb-4">
            <Scale className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Jurisprudência sobre Licitações e Contratos
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto mb-4">
            Compilação das principais decisões de Tribunais de Contas Estaduais e do Poder Judiciário sobre licitações e contratos administrativos na Lei 14.133/2021.
          </p>
          <p className="text-sm text-white/70 max-w-3xl mx-auto">
            A Área do Aluno reúne um acervo ainda mais amplo, incluindo acórdãos do TCU, decisões do CNJ e análises enriquecidas por inteligência artificial proprietária do site.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tribunal</label>
              <select
                value={tribunal}
                onChange={(e) => setTribunal(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[150px]"
              >
                <option value="">Todos</option>
                {TRIBUNALS.map(t => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[120px]"
              >
                <option value="">Todos</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSearch} className="flex-1 min-w-[250px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Busca</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por ementa, número..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </form>
          </div>

          {/* Theme tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {COMMON_THEMES.map(theme => (
              <button
                key={theme}
                onClick={() => setSelectedTheme(selectedTheme === theme ? '' : theme)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedTheme === theme
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>

        {/* CTA Teaser */}
        <div className="bg-gradient-to-r from-amber-50 to-blue-50 border border-amber-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-100 rounded-lg shrink-0">
              <Sparkles className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">Consulte com Inteligência Artificial</h3>
              <p className="text-sm text-gray-600 mb-3">
                Na Área do Aluno, faça perguntas sobre acórdãos e receba análises com referências à Lei 14.133/2021
              </p>
              <Link
                href="/planos"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Acesse a Área do Aluno <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border p-6 animate-pulse">
                <div className="flex gap-2 mb-3">
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                  <div className="h-5 w-20 bg-gray-200 rounded" />
                </div>
                <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-full bg-gray-200 rounded mb-1" />
                <div className="h-4 w-full bg-gray-200 rounded mb-1" />
                <div className="h-4 w-2/3 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <div className="text-center py-16">
            <Scale className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Nenhuma decisão encontrada
            </h3>
            <p className="text-gray-500">
              Tente ajustar os filtros selecionados
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              {total} decisão(ões) encontrada(s)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {decisions.map((decision) => {
                const themes = parseJsonArray(decision.themes);

                return (
                  <Link
                    key={decision.id}
                    href={`/jurisprudencia/${decision.id}`}
                    className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md hover:border-blue-200 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tribunalColor(decision.tribunalCode)}`}>
                        {tribunalLabel(decision.tribunalCode)}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                        {decision.decisionType}
                      </span>
                      {decision.dataJulgamento && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(decision.dataJulgamento).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {decision.title || decision.decisionNumber}
                    </h3>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                      {decision.ementa}
                    </p>

                    {decision.summary && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-1">
                          <Sparkles className="w-3 h-3" />
                          Resumo IA
                        </div>
                        <p className="text-sm text-blue-800 line-clamp-3">{decision.summary}</p>
                      </div>
                    )}

                    {themes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {themes.slice(0, 4).map((theme, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                            {theme}
                          </span>
                        ))}
                        {themes.length > 4 && (
                          <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-full">
                            +{themes.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center text-blue-600 text-sm font-medium group-hover:gap-2 gap-1 transition-all">
                      Ver detalhes <ArrowRight className="w-4 h-4" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
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
                  className={`px-3 py-2 border rounded-lg text-sm ${
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
              className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
