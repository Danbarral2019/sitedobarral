'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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

// Lista exibida no filtro público. TCU primeiro (mais relevante para
// licitações federais), depois TCEs e STJ. Códigos UPPERCASE alinhados
// com o que a API valida (z.enum) e com o que o DB armazena.
const TRIBUNALS = [
  { code: 'TCU', label: 'TCU' },
  { code: 'TCE-SP', label: 'TCE-SP' },
  { code: 'TCE-PR', label: 'TCE-PR' },
  { code: 'TCE-SC', label: 'TCE-SC' },
  { code: 'TCE-RJ', label: 'TCE-RJ' },
  { code: 'TCE-RS', label: 'TCE-RS' },
  { code: 'TCE-PE', label: 'TCE-PE' },
  { code: 'STJ', label: 'STJ' },
  { code: 'TST', label: 'TST (Súmulas)' },
];

/** Códigos de situação que aparecem em `themes` (gerados pelo importador TST). */
function extractSituacao(themes: string[]): string | null {
  const tag = themes.find((t) => t.startsWith('situacao:'));
  return tag ? tag.slice('situacao:'.length) : null;
}

function situacaoBadge(situacao: string): { label: string; className: string } {
  switch (situacao) {
    case 'CRIADA':
      return { label: 'Criada', className: 'bg-emerald-100 text-emerald-800' };
    case 'ALTERADA':
      return { label: 'Alterada', className: 'bg-amber-100 text-amber-800' };
    case 'CANCELADA':
      return { label: 'Cancelada', className: 'bg-red-100 text-red-800' };
    case 'REVISTA':
      return { label: 'Revista', className: 'bg-gray-200 text-gray-700' };
    default:
      return { label: situacao, className: 'bg-gray-100 text-gray-700' };
  }
}

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
  // Aceita ambos cases pra retro-compat com decisões antigas, mas a forma
  // canônica pós-normalização (2026-05-01) é UPPERCASE.
  const colors: Record<string, string> = {
    'TCU': 'bg-amber-100 text-amber-900',
    'TCE-SP': 'bg-blue-100 text-blue-800',
    'TCE-MG': 'bg-green-100 text-green-800',
    'TCE-PR': 'bg-purple-100 text-purple-800',
    'TCE-SC': 'bg-sky-100 text-sky-800',
    'TCE-RJ': 'bg-orange-100 text-orange-800',
    'TCE-RS': 'bg-violet-100 text-violet-800',
    'TCE-PE': 'bg-teal-100 text-teal-800',
    'STJ': 'bg-red-100 text-red-800',
    'STF': 'bg-rose-100 text-rose-800',
    'TST': 'bg-pink-100 text-pink-800',
  };
  return colors[code.toUpperCase()] || 'bg-gray-100 text-gray-800';
}

export default function JurisprudenciaClient() {
  const searchParams = useSearchParams();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters — inicializados a partir da query string para suportar deep-link
  // do hub `/base-conhecimento` (ex.: ?tribunal=TST&decisionType=sumula).
  const [tribunal, setTribunal] = useState(() => searchParams?.get('tribunal') ?? '');
  const [year, setYear] = useState(() => searchParams?.get('ano') ?? '');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [decisionType, setDecisionType] = useState(
    () => searchParams?.get('decisionType') ?? '',
  );
  const [sort, setSort] = useState<'recent' | 'oldest' | 'numero' | 'relevance'>('recent');
  // Default: esconde documentos canônicos inativos (CANCELADA/REVISTA) — toggle abaixo.
  // Aplica-se a Súmulas, OJs e PNs (todos têm tag `situacao:*` em themes).
  const [showInactive, setShowInactive] = useState(false);
  // Sub-filtro por série dentro de OJ (SBDI-I / SBDI-I Transitória / SBDI-II / SDC / Tribunal Pleno).
  const [ojSerie, setOjSerie] = useState('');
  const CANONICAL_TYPES = ['sumula', 'orientacao_jurisprudencial', 'precedente_normativo'];
  const isCanonicalView = CANONICAL_TYPES.includes(decisionType);
  const isOjView = decisionType === 'orientacao_jurisprudencial';

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
      // Sub-filtro de série de OJ é passado como `tema` adicional — o
      // importador grava em themes como `oj-sbdi-1` etc.
      else if (isOjView && ojSerie) params.set('tema', ojSerie);
      if (decisionType) params.set('decisionType', decisionType);
      if (sort && sort !== 'recent') params.set('sort', sort);
      // Filtra inativas para tipos canônicos (Súmulas, OJs, PNs) — todos
      // carregam tag `situacao:*` em themes. Acórdãos TCE/TCU não têm.
      if (isCanonicalView && !showInactive) {
        params.set('excludeInactive', 'true');
      }

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
  }, [tribunal, year, search, selectedTheme, decisionType, sort, showInactive, isOjView, ojSerie, isCanonicalView]);

  // Fetch when page changes
  useEffect(() => {
    fetchDecisions(currentPage);
  }, [currentPage, fetchDecisions]);

  // Reset to page 1 when filters change (fetchDecisions dep change triggers the fetch above)
  useEffect(() => {
    setCurrentPage(1);
  }, [tribunal, year, search, selectedTheme, decisionType, sort, showInactive, ojSerie]);

  // Quando muda decisionType para algo que não é OJ, limpa a sub-série.
  useEffect(() => {
    if (!isOjView && ojSerie) setOjSerie('');
  }, [isOjView, ojSerie]);

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={decisionType}
                onChange={(e) => setDecisionType(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[150px]"
              >
                <option value="">Todos</option>
                <option value="acordao">Acórdão</option>
                <option value="decisao">Decisão</option>
                <option value="parecer_previo">Parecer prévio</option>
                <option value="sumula">Súmula</option>
                <option value="orientacao_jurisprudencial">Orientação Jurisprudencial</option>
                <option value="precedente_normativo">Precedente Normativo</option>
              </select>
            </div>

            {/* Sub-filtro de série de OJ — visível só quando decisionType=orientacao_jurisprudencial */}
            {isOjView && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Série</label>
                <select
                  value={ojSerie}
                  onChange={(e) => setOjSerie(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[170px]"
                >
                  <option value="">Todas</option>
                  <option value="oj-sbdi-1">SBDI-I</option>
                  <option value="oj-sbdi-1t">SBDI-I Transitória</option>
                  <option value="oj-sbdi-2">SBDI-II</option>
                  <option value="oj-sdc">SDC</option>
                  <option value="oj-tp-oe">Tribunal Pleno / OE</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[160px]"
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="numero">Por número</option>
                {search && <option value="relevance">Mais relevantes</option>}
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

          {/* Toggle de documentos inativos — visível em qualquer visualização canônica
              (Súmulas, OJs, PNs). Acórdãos/decisões não têm tag situacao em themes. */}
          {isCanonicalView && (
            <div className="flex items-center gap-2 mt-4">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Mostrar canceladas/revistas (texto preservado por valor histórico)
              </label>
            </div>
          )}

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
                const situacao = CANONICAL_TYPES.includes(decision.decisionType) ? extractSituacao(themes) : null;
                const sitBadge = situacao ? situacaoBadge(situacao) : null;

                return (
                  <Link
                    key={decision.id}
                    href={`/jurisprudencia/${decision.id}`}
                    className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md hover:border-blue-200 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${tribunalColor(decision.tribunalCode)}`}>
                        {tribunalLabel(decision.tribunalCode)}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                        {decision.decisionType}
                      </span>
                      {sitBadge && (
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sitBadge.className}`}>
                          {sitBadge.label}
                        </span>
                      )}
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

                    {(() => {
                      // Esconde tags internas (situacao:*, tst, clt, clt-art-*) que
                      // alimentam filtros mas não interessam ao leitor — só temas
                      // semânticos viram chips visíveis.
                      const visibleThemes = themes.filter(
                        (t) =>
                          !t.startsWith('situacao:') &&
                          t !== 'tst' &&
                          t !== 'clt' &&
                          !t.startsWith('clt-art-'),
                      );
                      if (visibleThemes.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {visibleThemes.slice(0, 4).map((theme, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                              {theme}
                            </span>
                          ))}
                          {visibleThemes.length > 4 && (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-full">
                              +{visibleThemes.length - 4}
                            </span>
                          )}
                        </div>
                      );
                    })()}

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
