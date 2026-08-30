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

/**
 * Situação do enunciado. Só "Cancelada" recebe cor, porque é a única que muda
 * o que o leitor pode fazer com a peça. As demais ficam neutras: cor como
 * codificação de estado vira ruído quando todos os estados são normais.
 */
function situacaoBadge(situacao: string): { label: string; className: string } {
  const neutro = 'bg-surface-deep text-ink-secondary';
  switch (situacao) {
    case 'CRIADA':
      return { label: 'Criada', className: neutro };
    case 'ALTERADA':
      return { label: 'Alterada', className: neutro };
    case 'CANCELADA':
      return { label: 'Cancelada', className: 'bg-surface-deep text-semantic-error' };
    case 'REVISTA':
      return { label: 'Revista', className: neutro };
    default:
      return { label: situacao, className: neutro };
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

/**
 * Selo de fonte, um só para todos os tribunais.
 *
 * Antes havia onze matizes, um por corte (TCU âmbar, STF rosa, TCE-SP azul,
 * TCE-PE turquesa…). O DESIGN.md nomeia isso como anti-referência: "paleta
 * presa a qual ente publicou", o traço de portal de tribunal antigo. Quem
 * distingue as fontes é a sigla, que já está escrita no selo; a cor não
 * acrescenta informação e gasta o orçamento visual da página.
 */
const SELO_FONTE = 'bg-surface-raised text-ink-secondary';

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
    <main className="min-h-screen bg-surface-page">
      {/* Cabeçalho da listagem: alinhado à esquerda, com a contagem à vista.
          O número é o argumento; o ícone em vidro fosco sobre gradiente não
          era. Padrão que vale para as demais listagens do acervo. */}
      <header className="border-b border-border-subtle">
        <div className="container mx-auto px-4 max-w-[1280px] pt-6 pb-8">
          <p className="text-[0.8125rem] text-ink-muted mb-3">
            <Link href="/" className="hover:text-ink-primary transition-colors">
              Início
            </Link>
            {' · '}
            <Link href="/base-conhecimento" className="hover:text-ink-primary transition-colors">
              Acervo
            </Link>
            {' · '}
            <span className="text-ink-primary">Jurisprudência</span>
          </p>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-[2rem] md:text-[2.5rem] text-ink-primary mb-2">
                Jurisprudência
              </h1>
              <p className="text-[0.9375rem] leading-relaxed text-ink-secondary max-w-[74ch]">
                Decisões de Tribunais de Contas e do Poder Judiciário sobre licitações e contratos
                administrativos, com ementa, relator e link para a publicação oficial.
              </p>
            </div>
            {total > 0 && (
              <div className="text-right">
                <p className="font-mono text-[2rem] leading-none text-brand-600">
                  {total.toLocaleString('pt-BR')}
                </p>
                <p className="font-label text-ink-muted mt-1.5">
                  {total === 1 ? 'decisão encontrada' : 'decisões encontradas'}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 max-w-[1280px] py-8">
        {/* Filters */}
        <div className="bg-surface-page rounded-md border border-border-subtle p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1">Tribunal</label>
              <select
                value={tribunal}
                onChange={(e) => setTribunal(e.target.value)}
                className="px-3 py-2 border rounded-[3px] text-sm bg-surface-page min-w-[150px]"
              >
                <option value="">Todos</option>
                {TRIBUNALS.map(t => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1">Ano</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="px-3 py-2 border rounded-[3px] text-sm bg-surface-page min-w-[120px]"
              >
                <option value="">Todos</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1">Tipo</label>
              <select
                value={decisionType}
                onChange={(e) => setDecisionType(e.target.value)}
                className="px-3 py-2 border rounded-[3px] text-sm bg-surface-page min-w-[150px]"
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
                <label className="block text-sm font-medium text-ink-secondary mb-1">Série</label>
                <select
                  value={ojSerie}
                  onChange={(e) => setOjSerie(e.target.value)}
                  className="px-3 py-2 border rounded-[3px] text-sm bg-surface-page min-w-[170px]"
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
              <label className="block text-sm font-medium text-ink-secondary mb-1">Ordenar</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="px-3 py-2 border rounded-[3px] text-sm bg-surface-page min-w-[160px]"
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="numero">Por número</option>
                {search && <option value="relevance">Mais relevantes</option>}
              </select>
            </div>

            <form onSubmit={handleSearch} className="flex-1 min-w-[250px]">
              <label className="block text-sm font-medium text-ink-secondary mb-1">Busca</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por ementa, número..."
                  className="w-full pl-9 pr-3 py-2 border rounded-[3px] text-sm"
                />
              </div>
            </form>
          </div>

          {/* Toggle de documentos inativos — visível em qualquer visualização canônica
              (Súmulas, OJs, PNs). Acórdãos/decisões não têm tag situacao em themes. */}
          {isCanonicalView && (
            <div className="flex items-center gap-2 mt-4">
              <label className="inline-flex items-center gap-2 text-sm text-ink-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="w-4 h-4 rounded border-border-strong text-brand-600 focus:ring-amber-accent"
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
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-deep text-ink-secondary hover:bg-surface-deep'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>

        {/* CTA Teaser */}
        <div className="bg-surface-raised border border-border-strong rounded-md p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-accent-soft rounded-[3px] shrink-0">
              <Sparkles className="w-6 h-6 text-amber-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-ink-primary mb-1">Consulte com Inteligência Artificial</h3>
              <p className="text-sm text-ink-secondary mb-3">
                Na Área do Aluno, faça perguntas sobre acórdãos e receba análises com referências à Lei 14.133/2021
              </p>
              <Link
                href="/planos"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-[3px] hover:bg-brand-700 transition-colors"
              >
                Acesse a Área do Aluno <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="border-b border-border-subtle">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="py-5 border-t border-border-subtle animate-pulse">
                <div className="flex gap-2 mb-3">
                  <div className="h-5 w-16 bg-surface-deep rounded-[3px]" />
                  <div className="h-5 w-20 bg-surface-deep rounded-[3px]" />
                </div>
                <div className="h-5 w-3/4 bg-surface-deep rounded-[3px] mb-2" />
                <div className="h-4 w-full bg-surface-deep rounded-[3px] mb-1" />
                <div className="h-4 w-full bg-surface-deep rounded-[3px] mb-1" />
                <div className="h-4 w-2/3 bg-surface-deep rounded-[3px]" />
              </div>
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="font-heading text-[1.25rem] text-ink-primary mb-2">
              Nenhuma decisão encontrada
            </h3>
            <p className="text-sm text-ink-secondary max-w-[52ch] mx-auto">
              Tente remover um filtro, ampliar o período, ou buscar pelo número da decisão.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-muted pb-3 border-b border-border-subtle">
              Da mais recente para a mais antiga
            </p>

            <div className="border-b border-border-subtle">
              {decisions.map((decision) => {
                const themes = parseJsonArray(decision.themes);
                const situacao = CANONICAL_TYPES.includes(decision.decisionType) ? extractSituacao(themes) : null;
                const sitBadge = situacao ? situacaoBadge(situacao) : null;

                return (
                  <Link
                    key={decision.id}
                    href={`/jurisprudencia/${decision.id}`}
                    className="block py-5 border-t border-border-subtle group"
                  >
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`px-2 py-0.5 text-[0.6875rem] font-medium tracking-[0.06em] uppercase rounded-[3px] ${SELO_FONTE}`}>
                        {tribunalLabel(decision.tribunalCode)}
                      </span>
                      <span className="font-mono text-xs text-ink-muted">
                        {decision.decisionType}
                      </span>
                      {sitBadge && (
                        <span className={`px-2 py-0.5 text-[0.6875rem] font-medium tracking-[0.06em] uppercase rounded-[3px] ${sitBadge.className}`}>
                          {sitBadge.label}
                        </span>
                      )}
                      {decision.dataJulgamento && (
                        <span className="text-xs text-ink-muted flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(decision.dataJulgamento).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif font-medium text-[1.1875rem] text-ink-primary mb-1.5 group-hover:text-brand-600 transition-colors">
                      {decision.title || decision.decisionNumber}
                    </h3>

                    <p className="font-serif text-[0.9375rem] leading-relaxed text-ink-secondary mb-3 line-clamp-3 max-w-[84ch]">
                      {decision.ementa}
                    </p>

                    {decision.summary && (
                      <div className="bg-surface-raised border border-border-subtle rounded-[3px] p-3 mb-3 max-w-[84ch]">
                        <div className="flex items-center gap-1.5 font-label text-ink-muted mb-1.5">
                          <Sparkles className="w-3 h-3" />
                          Resumo por IA
                        </div>
                        <p className="font-serif text-sm leading-relaxed text-ink-secondary line-clamp-3">{decision.summary}</p>
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
                            <span key={i} className="px-2 py-0.5 bg-surface-raised text-brand-700 text-xs rounded-full">
                              {theme}
                            </span>
                          ))}
                          {visibleThemes.length > 4 && (
                            <span className="px-2 py-0.5 bg-surface-raised text-ink-muted text-xs rounded-full">
                              +{visibleThemes.length - 4}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center text-brand-600 text-sm font-medium group-hover:gap-2 gap-1 transition-all">
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
              className="px-3 py-2 border rounded-[3px] text-sm hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
                  className={`px-3 py-2 border rounded-[3px] text-sm ${
                    currentPage === page
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'hover:bg-surface-raised'
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border rounded-[3px] text-sm hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
