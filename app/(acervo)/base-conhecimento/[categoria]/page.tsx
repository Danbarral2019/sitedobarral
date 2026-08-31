import Link from 'next/link';
import Form from 'next/form';
import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import {
  ArrowLeft, ArrowRight, FileText, BookOpen, List, Book, Search, ChevronLeft, ChevronRight, AlertTriangle, X,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { NavigateSelect } from '@/components/acervo/NavigateSelect';

export const revalidate = 3600;

type TipoOption = { value: string; label: string; dbCategories: readonly string[] };

type CategoryConfig = {
  slug: string;
  label: string;
  description: string;
  icon: typeof FileText;
  dbCategories: readonly string[];
  orderBy: 'recent' | 'numeroDecrescente';
  showDescription: boolean;
  enteFilter?: { entes: readonly string[]; placeholder: string };
  // Filtros avançados (CONUNI/AGU)
  tipoFilter?: { options: readonly TipoOption[] }; // pílulas pra Pareceres/Notas/Despachos/Vinculantes
  orgaoFilter?: { orgaos: readonly string[] };     // dropdown pra câmara/coordenação
  vigenciaFilter?: boolean;                         // pílulas Vigentes/Revogados/Modificados
  yearFilter?: { years: readonly number[] };       // dropdown ano (extraído do título)
  cursoFilter?: { cursos: ReadonlyArray<{ id: string; label: string }> }; // dropdown curso (do classify Gemini)
  sortOptions?: ReadonlyArray<{ value: string; label: string }>;
};

const COURSE_OPTIONS = [
  { id: '2', label: 'Planejamento' },
  { id: '3', label: 'Gestão e Fiscalização' },
  { id: '4', label: 'Sancionador' },
  { id: '7', label: 'Assessoramento Jurídico' },
  { id: '8', label: 'Revisão/Reajuste' },
  { id: '9', label: 'Alterações Contratuais' },
  { id: '10', label: 'Contratação Direta' },
] as const;

// Anos comuns nos pareceres CONUNI (2007-2026)
const PARECER_YEARS = Array.from({ length: 2026 - 2007 + 1 }, (_, i) => 2026 - i);

const CONUNI_ORGAOS = [
  'CONUNI', 'CNLCA', 'CNCIC', 'CNMLC', 'CNPAD', 'CNDE', 'CNPAT',
  'CNASP', 'CNPDI', 'CNS', 'CNU', 'CNIR',
] as const;

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  pareceres: {
    slug: 'pareceres',
    label: 'Pareceres, Notas e Despachos',
    description:
      'Manifestações da Advocacia-Geral da União (CONUNI/DECOR): pareceres uniformizantes (incluindo vinculantes), notas técnicas e despachos sobre licitações e contratos.',
    icon: FileText,
    dbCategories: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'],
    orderBy: 'recent',
    showDescription: true,
    tipoFilter: {
      options: [
        { value: 'parecer', label: 'Pareceres', dbCategories: ['parecer'] },
        { value: 'vinculante', label: 'Vinculantes', dbCategories: ['parecer-vinculante'] },
        { value: 'nota-tecnica', label: 'Notas técnicas', dbCategories: ['nota-tecnica'] },
        { value: 'despacho', label: 'Despachos', dbCategories: ['despacho'] },
      ],
    },
    orgaoFilter: { orgaos: CONUNI_ORGAOS },
    vigenciaFilter: true,
    yearFilter: { years: PARECER_YEARS },
    cursoFilter: { cursos: COURSE_OPTIONS },
    sortOptions: [
      { value: 'recent', label: 'Mais recentes' },
      { value: 'oldest', label: 'Mais antigos' },
      { value: 'alpha', label: 'A→Z' },
      { value: 'alpha-desc', label: 'Z→A' },
    ],
  },
  'orientacoes-normativas': {
    slug: 'orientacoes-normativas',
    label: 'Orientações Normativas',
    description:
      'ONs da AGU organizadas por número e ano. Para o link oficial no DOU de cada orientação, abra o documento individual.',
    icon: BookOpen,
    dbCategories: ['orientacao-normativa'],
    orderBy: 'numeroDecrescente',
    showDescription: true,
    sortOptions: [
      { value: 'recent', label: 'Número (mais recente)' },
      { value: 'numero-asc', label: 'Número (mais antigo)' },
      { value: 'alpha', label: 'A→Z' },
    ],
  },
  enunciados: {
    slug: 'enunciados',
    label: 'Enunciados',
    description:
      'Enunciados do CJF (Simpósios de Licitações e Contratos da Justiça Federal), do IBDA (Instituto Brasileiro de Direito Administrativo) e do INCP (Instituto Nacional de Contratações Públicas), aprovados em simpósios, jornadas e reuniões técnicas.',
    icon: List,
    dbCategories: ['enunciados'],
    orderBy: 'recent',
    showDescription: true,
    enteFilter: { entes: ['CJF', 'IBDA', 'INCP'], placeholder: 'Filtrar por ente' },
    sortOptions: [
      { value: 'recent', label: 'Mais recentes' },
      { value: 'oldest', label: 'Mais antigos' },
      { value: 'alpha', label: 'A→Z' },
    ],
  },
  'manual-tcu': {
    slug: 'manual-tcu',
    label: 'Manual de Licitações do TCU',
    description:
      'Manual oficial do Tribunal de Contas da União sobre licitações e contratos, totalmente indexado.',
    icon: Book,
    dbCategories: ['manual-tcu'],
    orderBy: 'recent',
    showDescription: true,
    sortOptions: [
      { value: 'recent', label: 'Ordem do manual' },
      { value: 'alpha', label: 'A→Z' },
    ],
  },
};

const PAGE_SIZE = 20;

interface PageProps {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<{
    page?: string;
    q?: string;
    ente?: string;
    tipo?: string;
    orgao?: string;
    vigencia?: string;
    ano?: string;
    curso?: string;
    sort?: string;
  }>;
}

export async function generateStaticParams() {
  return Object.keys(CATEGORY_CONFIG).map((categoria) => ({ categoria }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoria } = await params;
  if (categoria === 'acordaos') return { title: 'Redirecionando…' };
  if (categoria === 'notas-tecnicas' || categoria === 'despachos') return { title: 'Redirecionando…' };
  const cfg = CATEGORY_CONFIG[categoria];
  if (!cfg) return { title: 'Categoria não encontrada' };
  return {
    title: `${cfg.label} | Base de Conhecimento | Prof. Daniel Barral`,
    description: cfg.description,
    alternates: {
      canonical: `/base-conhecimento/${categoria}`,
    },
  };
}

function getOrderBy(orderBy: CategoryConfig['orderBy'], sort?: string) {
  if (sort === 'oldest') return [{ uploadedAt: 'asc' as const }];
  if (sort === 'alpha') return [{ title: 'asc' as const }];
  if (sort === 'alpha-desc') return [{ title: 'desc' as const }];
  if (sort === 'numero-asc' && orderBy === 'numeroDecrescente') {
    return [
      { acordaoAno: 'asc' as const },
      { acordaoNumero: 'asc' as const },
      { onYear: 'asc' as const },
      { onNumber: 'asc' as const },
      { uploadedAt: 'asc' as const },
    ];
  }
  if (orderBy === 'numeroDecrescente') {
    return [
      { acordaoAno: 'desc' as const },
      { acordaoNumero: 'desc' as const },
      { onYear: 'desc' as const },
      { onNumber: 'desc' as const },
      { uploadedAt: 'desc' as const },
    ];
  }
  return [{ uploadedAt: 'desc' as const }];
}

function buildFilterUrl(
  categoria: string,
  current: { q?: string; tipo?: string; orgao?: string; vigencia?: string; ente?: string; ano?: string; curso?: string; sort?: string; page?: number },
  changes: Partial<typeof current>,
): string {
  const merged = { ...current, ...changes };
  const params = new URLSearchParams();
  if (merged.q) params.set('q', merged.q);
  if (merged.tipo) params.set('tipo', merged.tipo);
  if (merged.orgao) params.set('orgao', merged.orgao);
  if (merged.vigencia) params.set('vigencia', merged.vigencia);
  if (merged.ente) params.set('ente', merged.ente);
  if (merged.ano) params.set('ano', merged.ano);
  if (merged.curso) params.set('curso', merged.curso);
  if (merged.sort && merged.sort !== 'recent') params.set('sort', merged.sort);
  if (merged.page && merged.page > 1) params.set('page', String(merged.page));
  const qs = params.toString();
  return `/base-conhecimento/${categoria}${qs ? `?${qs}` : ''}`;
}

export default async function CategoriaPage({ params, searchParams }: PageProps) {
  const { categoria } = await params;

  // Redirects de URLs antigas
  if (categoria === 'acordaos') redirect('/jurisprudencia');
  if (categoria === 'notas-tecnicas') redirect('/base-conhecimento/pareceres?tipo=nota-tecnica');
  if (categoria === 'despachos') redirect('/base-conhecimento/pareceres?tipo=despacho');

  const sp = await searchParams;
  const cfg = CATEGORY_CONFIG[categoria];
  if (!cfg) notFound();

  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;
  const searchTerm = sp.q?.trim() || '';

  // Filtro ente (enunciados)
  const enteFilter = cfg.enteFilter && sp.ente && cfg.enteFilter.entes.includes(sp.ente) ? sp.ente : '';

  // Filtros CONUNI
  const tipoFilter = cfg.tipoFilter && sp.tipo && cfg.tipoFilter.options.some(o => o.value === sp.tipo)
    ? sp.tipo : '';
  const orgaoFilter = cfg.orgaoFilter && sp.orgao && cfg.orgaoFilter.orgaos.includes(sp.orgao as typeof CONUNI_ORGAOS[number])
    ? sp.orgao : '';
  const vigenciaFilter = cfg.vigenciaFilter && sp.vigencia && ['vigente', 'revogado', 'modificado'].includes(sp.vigencia)
    ? sp.vigencia : '';
  const anoFilter = cfg.yearFilter && sp.ano && /^\d{4}$/.test(sp.ano) ? sp.ano : '';
  const cursoFilter = cfg.cursoFilter && sp.curso && cfg.cursoFilter.cursos.some(c => c.id === sp.curso)
    ? sp.curso : '';
  const sortFilter = cfg.sortOptions && sp.sort && cfg.sortOptions.some(s => s.value === sp.sort)
    ? sp.sort : 'recent';

  // Resolve dbCategories: se tipoFilter ativo, usa o subset; senão, todos da categoria
  const activeDbCategories = tipoFilter && cfg.tipoFilter
    ? cfg.tipoFilter.options.find(o => o.value === tipoFilter)!.dbCategories
    : cfg.dbCategories;

  type WhereClause = {
    isPublic: boolean;
    isCommon?: boolean;
    category: { in: string[] };
    OR?: Array<Record<string, unknown>>;
    AND?: Array<Record<string, unknown>>;
    tags?: { contains: string };
    title?: { contains: string };
    NOT?: Record<string, unknown>;
  };

  // Coleta todos os "contains" do aiClassification e empacota em AND
  const aiContains: string[] = [];

  const where: WhereClause = {
    isPublic: true,
    category: { in: [...activeDbCategories] },
  };

  // Pra categorias CONUNI: esconde irrelevantes (Gemini)
  if (cfg.tipoFilter) {
    where.NOT = { aiClassification: { contains: '"licitacoesContratos":false' } };
  }

  if (searchTerm) {
    where.OR = [
      { title: { contains: searchTerm, mode: 'insensitive' as const } },
      { description: { contains: searchTerm, mode: 'insensitive' as const } },
    ];
  }

  // tags é JSON-stringified array — usar contains com aspas pra reduzir falsos positivos
  if (enteFilter) where.tags = { contains: `"${enteFilter}"` };
  if (orgaoFilter) where.tags = { contains: `"${orgaoFilter}"` };

  if (vigenciaFilter) aiContains.push(`"vigencia":"${vigenciaFilter}"`);
  if (cursoFilter) aiContains.push(`"cursosRelevantes":${JSON.stringify([cursoFilter]).slice(0, -1)}`);
  // ↑ heurística: cursosRelevantes é array; busca por '["X"' ou '"X"' dentro do array.
  // Postgres JSON contains de string parcial — pode ter falso positivo se outro array tiver "X" como sufixo.
  // Pra simplificar: busca qualquer ocorrência de "X" entre aspas (cursos são IDs curtos).
  if (cursoFilter) {
    // override mais seguro: substring com aspas isolando o id
    aiContains[aiContains.length - 1] = `"${cursoFilter}"`;
  }

  // Ano: filtra pelo padrão "/AAAA/" no título (formato CONUNI: "PARECER nº 0001/2024/CNCIC/CGU/AGU")
  if (anoFilter) where.title = { contains: `/${anoFilter}/` };

  // Combina todos os "contains" do aiClassification em AND
  if (aiContains.length === 1) {
    (where as Record<string, unknown>).aiClassification = { contains: aiContains[0] };
  } else if (aiContains.length > 1) {
    where.AND = aiContains.map(c => ({ aiClassification: { contains: c } }));
  }

  let docs: Array<{
    id: string;
    title: string;
    description: string | null;
    url: string;
    uploadedAt: Date;
    acordaoNumero: number | null;
    acordaoAno: number | null;
    onNumber: number | null;
    onYear: number | null;
    tags: string | null;
    aiClassification: string | null;
    category: string;
  }> = [];
  let total = 0;

  try {
    [docs, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          url: true,
          uploadedAt: true,
          acordaoNumero: true,
          acordaoAno: true,
          onNumber: true,
          onYear: true,
          tags: true,
          aiClassification: true,
          category: true,
        },
        orderBy: getOrderBy(cfg.orderBy, sortFilter),
        skip,
        take: PAGE_SIZE,
      }),
      prisma.document.count({ where }),
    ]);
  } catch {
    // DB indisponível
  }

  function getVigencia(aiCls: string | null): 'revogado' | 'modificado' | null {
    if (!aiCls) return null;
    try {
      const parsed = JSON.parse(aiCls) as { vigencia?: string };
      if (parsed.vigencia === 'revogado') return 'revogado';
      if (parsed.vigencia === 'modificado') return 'modificado';
      return null;
    } catch { return null; }
  }

  // Retorna summary IA se existir; senão, fallback pra description.
  // Filtra strings inúteis comuns (ementa CONUNI: "", "-", "Não há.").
  function getDisplayDescription(aiCls: string | null, fallback: string | null): string | null {
    if (aiCls) {
      try {
        const parsed = JSON.parse(aiCls) as { summary?: string };
        if (parsed.summary && parsed.summary.trim().length > 5) return parsed.summary.trim();
      } catch { /* ignora */ }
    }
    const fb = (fallback || '').trim();
    if (!fb) return null;
    const lower = fb.toLowerCase();
    if (lower === '-' || lower === 'não há.' || lower === 'não há' || lower === 'nao ha' || lower === 'nao ha.') {
      return null;
    }
    return fb;
  }

  function getTipoLabel(category: string): string | null {
    if (category === 'parecer-vinculante') return 'Vinculante';
    if (category === 'nota-tecnica') return 'Nota técnica';
    if (category === 'despacho') return 'Despacho';
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const Icon = cfg.icon;
  const currentParams = {
    q: searchTerm, tipo: tipoFilter, orgao: orgaoFilter, vigencia: vigenciaFilter, ente: enteFilter,
    ano: anoFilter, curso: cursoFilter, sort: sortFilter === 'recent' ? '' : sortFilter,
  };
  const hasAdvancedFilters = !!(cfg.tipoFilter || cfg.orgaoFilter || cfg.vigenciaFilter || cfg.yearFilter || cfg.cursoFilter || cfg.sortOptions);
  const hasActiveFilter = !!(searchTerm || tipoFilter || orgaoFilter || vigenciaFilter || enteFilter || anoFilter || cursoFilter || (sortFilter && sortFilter !== 'recent'));

  return (
    <main className="min-h-screen bg-surface-raised">
      {/* Hero */}
      <section className="bg-brand-700 text-white py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <Link
              href="/base-conhecimento"
              className="inline-flex items-center gap-2 text-brand-100 hover:text-white mb-6 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Base de Conhecimento
            </Link>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white/15 rounded-[6px] flex items-center justify-center flex-shrink-0">
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-heading font-semibold mb-2 tracking-wide">
                  {cfg.label}
                </h1>
                <p className="text-base md:text-lg text-brand-100 font-sans leading-relaxed max-w-3xl">
                  {cfg.description}
                </p>
                <p className="text-sm text-brand-200 mt-3 font-sans">
                  {searchTerm ? (
                    <>
                      {total.toLocaleString('pt-BR')} {total === 1 ? 'resultado' : 'resultados'} para &quot;{searchTerm}&quot;
                    </>
                  ) : (
                    <>
                      {total.toLocaleString('pt-BR')} {total === 1 ? 'documento disponível' : 'documentos disponíveis'}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Busca + filtros + lista */}
      <section className="container mx-auto px-4 py-10 md:py-12 max-w-5xl">
        <Form action={`/base-conhecimento/${categoria}`} scroll={false} className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted pointer-events-none" />
            <input
              type="text"
              name="q"
              defaultValue={searchTerm}
              placeholder={`Buscar em ${cfg.label.toLowerCase()}...`}
              className="w-full pl-12 pr-4 py-3 bg-white border border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base font-sans"
              aria-label={`Buscar em ${cfg.label}`}
            />
          </div>
          {/* Preserva filtros ativos como hidden inputs ao submeter busca */}
          {tipoFilter && <input type="hidden" name="tipo" value={tipoFilter} />}
          {orgaoFilter && <input type="hidden" name="orgao" value={orgaoFilter} />}
          {vigenciaFilter && <input type="hidden" name="vigencia" value={vigenciaFilter} />}
          {enteFilter && <input type="hidden" name="ente" value={enteFilter} />}
          {anoFilter && <input type="hidden" name="ano" value={anoFilter} />}
          {cursoFilter && <input type="hidden" name="curso" value={cursoFilter} />}
          {sortFilter && sortFilter !== 'recent' && <input type="hidden" name="sort" value={sortFilter} />}
        </Form>

        {/* Filtro por ente (enunciados) */}
        {cfg.enteFilter && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-muted font-medium mr-1">Ente:</span>
            <Link
              href={buildFilterUrl(categoria, currentParams, { ente: '', page: 1 })}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !enteFilter ? 'bg-brand-600 text-white' : 'bg-white border border-border-subtle text-ink-secondary hover:border-brand-400'
              }`}
            >
              Todos
            </Link>
            {cfg.enteFilter.entes.map((e) => (
              <Link
                key={e}
                href={buildFilterUrl(categoria, currentParams, { ente: e, page: 1 })}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  enteFilter === e ? 'bg-brand-600 text-white' : 'bg-white border border-border-subtle text-ink-secondary hover:border-brand-400'
                }`}
              >
                {e}
              </Link>
            ))}
          </div>
        )}

        {/* Filtros CONUNI (pareceres) — visual igual ao /legislacao */}
        {hasAdvancedFilters && (() => {
          const preservedAll = {
            q: searchTerm,
            tipo: tipoFilter,
            orgao: orgaoFilter,
            vigencia: vigenciaFilter,
            ano: anoFilter,
            curso: cursoFilter,
            ente: enteFilter,
            ...(sortFilter !== 'recent' ? { sort: sortFilter } : {}),
          };
          const basePath = `/base-conhecimento/${categoria}`;
          return (
            <div className="bg-white border-2 border-border-subtle rounded-[6px] p-6 space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cfg.tipoFilter && (
                  <div>
                    <label className="block text-sm font-bold text-ink-secondary mb-2">Tipo</label>
                    <NavigateSelect
                      basePath={basePath}
                      param="tipo"
                      preservedParams={{ ...preservedAll, tipo: '' }}
                      value={tipoFilter}
                      options={cfg.tipoFilter.options.map(o => ({ value: o.value, label: o.label }))}
                      ariaLabel="Filtrar por tipo"
                      className="w-full px-4 py-2 border-2 border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}
                {cfg.orgaoFilter && (
                  <div>
                    <label className="block text-sm font-bold text-ink-secondary mb-2">Câmara</label>
                    <NavigateSelect
                      basePath={basePath}
                      param="orgao"
                      preservedParams={{ ...preservedAll, orgao: '' }}
                      value={orgaoFilter}
                      options={cfg.orgaoFilter.orgaos.map(o => ({ value: o, label: o }))}
                      ariaLabel="Filtrar por câmara"
                      className="w-full px-4 py-2 border-2 border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}
                {cfg.vigenciaFilter && (
                  <div>
                    <label className="block text-sm font-bold text-ink-secondary mb-2">Vigência</label>
                    <NavigateSelect
                      basePath={basePath}
                      param="vigencia"
                      preservedParams={{ ...preservedAll, vigencia: '' }}
                      value={vigenciaFilter}
                      options={[
                        { value: 'vigente', label: 'Vigentes' },
                        { value: 'revogado', label: 'Revogados' },
                        { value: 'modificado', label: 'Modificados' },
                      ]}
                      emptyLabel="Todas"
                      ariaLabel="Filtrar por vigência"
                      className="w-full px-4 py-2 border-2 border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}
                {cfg.yearFilter && (
                  <div>
                    <label className="block text-sm font-bold text-ink-secondary mb-2">Ano</label>
                    <NavigateSelect
                      basePath={basePath}
                      param="ano"
                      preservedParams={{ ...preservedAll, ano: '' }}
                      value={anoFilter}
                      options={cfg.yearFilter.years.map(y => ({ value: String(y), label: String(y) }))}
                      ariaLabel="Filtrar por ano"
                      className="w-full px-4 py-2 border-2 border-border-subtle rounded-[6px] focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}
              </div>

              {/* Curso — chips (igual aos Temas dos atos normativos) */}
              {cfg.cursoFilter && (
                <div>
                  <label className="block text-sm font-bold text-ink-secondary mb-2">Cursos relevantes</label>
                  <div className="flex flex-wrap gap-2">
                    {cfg.cursoFilter.cursos.map((c) => (
                      <Link
                        key={c.id}
                        href={buildFilterUrl(categoria, currentParams, { curso: cursoFilter === c.id ? '' : c.id, page: 1 })}
                        className={`px-3 py-1.5 text-xs rounded-full border-2 transition-colors font-medium ${
                          cursoFilter === c.id
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-ink-secondary border-border-subtle hover:border-border-strong'
                        }`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Ordenar + Limpar */}
              {(cfg.sortOptions || hasActiveFilter) && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border-subtle">
                  {cfg.sortOptions && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ink-muted font-medium">Ordenar:</span>
                      <div className="flex flex-wrap gap-1">
                        {cfg.sortOptions.map((opt) => (
                          <Link
                            key={opt.value}
                            href={buildFilterUrl(categoria, currentParams, { sort: opt.value, page: 1 })}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              sortFilter === opt.value ? 'bg-brand-900 text-white' : 'bg-white border border-border-subtle text-ink-secondary hover:border-border-strong'
                            }`}
                          >
                            {opt.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasActiveFilter && (
                    <Link
                      href={`/base-conhecimento/${categoria}`}
                      className="ml-auto text-xs font-medium text-ink-muted hover:text-brand-700 underline"
                    >
                      Limpar todos os filtros
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Disclaimer pra ONs */}
        {categoria === 'orientacoes-normativas' && (
          <div className="mb-6 bg-brand-50 border border-brand-200 rounded-[6px] p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-brand-900 leading-relaxed">
              <p className="font-semibold mb-1">Texto oficial</p>
              <p>
                Os enunciados abaixo reproduzem a redação oficial publicada pela AGU. Para o link
                no DOU de cada orientação (em consolidação), abra o documento individual.
              </p>
            </div>
          </div>
        )}

        {/* Banner de resultados de busca — deixa claro que a lista é resposta à query */}
        {searchTerm && (
          <div className="mb-4 flex items-center justify-between gap-3 bg-brand-50 border border-brand-200 rounded-[6px] px-4 py-3">
            <div className="text-sm text-brand-900 leading-snug">
              <span className="font-semibold">{total.toLocaleString('pt-BR')}</span>
              {' '}{total === 1 ? 'resultado' : 'resultados'} para
              {' '}<span className="font-semibold">&quot;{searchTerm}&quot;</span>
            </div>
            <Link
              href={buildFilterUrl(categoria, currentParams, { q: '', page: 1 })}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900 whitespace-nowrap"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
              Limpar busca
            </Link>
          </div>
        )}

        {docs.length === 0 ? (
          <div className="bg-white border border-border-subtle rounded-[6px] p-12 text-center">
            <p className="text-ink-muted">
              {hasActiveFilter
                ? 'Nenhum documento encontrado com os filtros atuais.'
                : 'Nenhum documento disponível nesta categoria no momento.'}
            </p>
            {hasActiveFilter && (
              <Link
                href={`/base-conhecimento/${categoria}`}
                className="inline-block mt-4 text-brand-600 hover:text-brand-700 font-semibold"
              >
                Limpar filtros
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {docs.map((doc) => {
              let enteTag: string | null = null;
              if (cfg.enteFilter && doc.tags) {
                try {
                  const parsed = JSON.parse(doc.tags);
                  if (Array.isArray(parsed)) {
                    enteTag = parsed.find((t: string) => cfg.enteFilter?.entes.includes(t)) || null;
                  }
                } catch {
                  // tags malformadas; ignora
                }
              }
              const tipoLabel = cfg.tipoFilter ? getTipoLabel(doc.category) : null;
              const v = getVigencia(doc.aiClassification);
              return (
                <li key={doc.id}>
                  <Link
                    href={`/documento/${doc.id}`}
                    className="block bg-white border border-border-subtle rounded-[6px] p-5 hover:border-brand-400 hover: transition-all group focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      {enteTag && (
                        <span className="inline-block px-2 py-0.5 bg-brand-50 text-brand-700 text-xs font-semibold rounded-md mt-0.5">
                          {enteTag}
                        </span>
                      )}
                      {tipoLabel && (
                        <span className="inline-block px-2 py-0.5 bg-brand-50 text-brand-700 text-xs font-semibold rounded-md mt-0.5">
                          {tipoLabel}
                        </span>
                      )}
                      {v === 'revogado' && (
                        <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wide rounded-md mt-0.5">
                          Revogado
                        </span>
                      )}
                      {v === 'modificado' && (
                        <span className="inline-block px-2 py-0.5 bg-amber-accent-soft text-ink-primary text-xs font-bold uppercase tracking-wide rounded-md mt-0.5">
                          Modificado
                        </span>
                      )}
                      <h2 className="text-base md:text-lg font-semibold text-ink-primary group-hover:text-brand-700 transition-colors leading-snug flex-1 basis-full sm:basis-auto">
                        {doc.title}
                      </h2>
                    </div>
                    {cfg.showDescription && (() => {
                      const desc = getDisplayDescription(doc.aiClassification, doc.description);
                      return desc ? (
                        <p className="text-sm text-ink-muted leading-relaxed line-clamp-2 ml-0">
                          {desc}
                        </p>
                      ) : null;
                    })()}
                    <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                      {doc.acordaoAno && doc.acordaoNumero && (
                        <span>Acórdão {doc.acordaoNumero}/{doc.acordaoAno}</span>
                      )}
                      {doc.onYear && doc.onNumber && (
                        <span>ON {doc.onNumber}/{doc.onYear}</span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 text-brand-600 group-hover:gap-2 transition-all font-medium">
                        Ver detalhes
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginação">
            {page > 1 && (
              <Link
                href={buildFilterUrl(categoria, currentParams, { page: page - 1 })}
                className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-border-subtle rounded-[6px] text-sm font-medium text-ink-secondary hover:border-brand-400 hover:text-brand-700"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Link>
            )}
            <span className="px-4 py-2 text-sm text-ink-muted font-medium">
              Página {page} de {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildFilterUrl(categoria, currentParams, { page: page + 1 })}
                className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-border-subtle rounded-[6px] text-sm font-medium text-ink-secondary hover:border-brand-400 hover:text-brand-700"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
