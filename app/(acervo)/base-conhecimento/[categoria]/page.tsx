import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import {
  ArrowLeft, ArrowRight, FileText, BookOpen, List, Book, Search, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';

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
};

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

function getOrderBy(orderBy: CategoryConfig['orderBy']) {
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
  current: { q?: string; tipo?: string; orgao?: string; vigencia?: string; ente?: string; page?: number },
  changes: Partial<typeof current>,
): string {
  const merged = { ...current, ...changes };
  const params = new URLSearchParams();
  if (merged.q) params.set('q', merged.q);
  if (merged.tipo) params.set('tipo', merged.tipo);
  if (merged.orgao) params.set('orgao', merged.orgao);
  if (merged.vigencia) params.set('vigencia', merged.vigencia);
  if (merged.ente) params.set('ente', merged.ente);
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
    aiClassification?: { contains: string };
  };

  const where: WhereClause = {
    isPublic: true,
    category: { in: [...activeDbCategories] },
  };

  if (searchTerm) {
    where.OR = [
      { title: { contains: searchTerm, mode: 'insensitive' as const } },
      { description: { contains: searchTerm, mode: 'insensitive' as const } },
    ];
  }

  // tags é JSON-stringified array — usar contains com aspas pra reduzir falsos positivos
  if (enteFilter) where.tags = { contains: `"${enteFilter}"` };
  if (orgaoFilter) where.tags = { contains: `"${orgaoFilter}"` };

  // vigencia vive em aiClassification JSON (preenchida pelo sync CONUNI)
  if (vigenciaFilter) {
    where.aiClassification = { contains: `"vigencia":"${vigenciaFilter}"` };
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
        orderBy: getOrderBy(cfg.orderBy),
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

  function getTipoLabel(category: string): string | null {
    if (category === 'parecer-vinculante') return 'Vinculante';
    if (category === 'nota-tecnica') return 'Nota técnica';
    if (category === 'despacho') return 'Despacho';
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const Icon = cfg.icon;
  const currentParams = { q: searchTerm, tipo: tipoFilter, orgao: orgaoFilter, vigencia: vigenciaFilter, ente: enteFilter };
  const hasAdvancedFilters = !!(cfg.tipoFilter || cfg.orgaoFilter || cfg.vigenciaFilter);
  const hasActiveFilter = !!(searchTerm || tipoFilter || orgaoFilter || vigenciaFilter || enteFilter);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-600 to-brand-700 text-white py-12 md:py-16">
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
              <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-cinzel font-semibold mb-2 tracking-wide">
                  {cfg.label}
                </h1>
                <p className="text-base md:text-lg text-brand-100 font-poppins leading-relaxed max-w-3xl">
                  {cfg.description}
                </p>
                <p className="text-sm text-brand-200 mt-3 font-poppins">
                  {total.toLocaleString('pt-BR')} {total === 1 ? 'documento disponível' : 'documentos disponíveis'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Busca + filtros + lista */}
      <section className="container mx-auto px-4 py-10 md:py-12 max-w-5xl">
        <form method="get" className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              name="q"
              defaultValue={searchTerm}
              placeholder={`Buscar em ${cfg.label.toLowerCase()}...`}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base font-poppins"
              aria-label={`Buscar em ${cfg.label}`}
            />
          </div>
          {/* Preserva filtros ativos como hidden inputs ao submeter busca */}
          {tipoFilter && <input type="hidden" name="tipo" value={tipoFilter} />}
          {orgaoFilter && <input type="hidden" name="orgao" value={orgaoFilter} />}
          {vigenciaFilter && <input type="hidden" name="vigencia" value={vigenciaFilter} />}
          {enteFilter && <input type="hidden" name="ente" value={enteFilter} />}
        </form>

        {/* Filtro por ente (enunciados) */}
        {cfg.enteFilter && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 font-medium mr-1">Ente:</span>
            <Link
              href={buildFilterUrl(categoria, currentParams, { ente: '', page: 1 })}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !enteFilter ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
              }`}
            >
              Todos
            </Link>
            {cfg.enteFilter.entes.map((e) => (
              <Link
                key={e}
                href={buildFilterUrl(categoria, currentParams, { ente: e, page: 1 })}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  enteFilter === e ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
                }`}
              >
                {e}
              </Link>
            ))}
          </div>
        )}

        {/* Filtros CONUNI (pareceres) */}
        {hasAdvancedFilters && (
          <div className="mb-6 space-y-3">
            {cfg.tipoFilter && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 font-medium mr-1 min-w-[60px]">Tipo:</span>
                <Link
                  href={buildFilterUrl(categoria, currentParams, { tipo: '', page: 1 })}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    !tipoFilter ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
                  }`}
                >
                  Todos
                </Link>
                {cfg.tipoFilter.options.map((opt) => (
                  <Link
                    key={opt.value}
                    href={buildFilterUrl(categoria, currentParams, { tipo: opt.value, page: 1 })}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      tipoFilter === opt.value ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            )}

            {cfg.vigenciaFilter && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 font-medium mr-1 min-w-[60px]">Vigência:</span>
                <Link
                  href={buildFilterUrl(categoria, currentParams, { vigencia: '', page: 1 })}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    !vigenciaFilter ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
                  }`}
                >
                  Todas
                </Link>
                {(['vigente', 'revogado', 'modificado'] as const).map((v) => (
                  <Link
                    key={v}
                    href={buildFilterUrl(categoria, currentParams, { vigencia: v, page: 1 })}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize ${
                      vigenciaFilter === v
                        ? v === 'revogado' ? 'bg-red-600 text-white' : v === 'modificado' ? 'bg-amber-600 text-white' : 'bg-brand-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
                    }`}
                  >
                    {v === 'vigente' ? 'Vigentes' : v === 'revogado' ? 'Revogados' : 'Modificados'}
                  </Link>
                ))}
              </div>
            )}

            {cfg.orgaoFilter && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 font-medium mr-1 min-w-[60px]">Câmara:</span>
                <Link
                  href={buildFilterUrl(categoria, currentParams, { orgao: '', page: 1 })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    !orgaoFilter ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
                  }`}
                >
                  Todas
                </Link>
                {cfg.orgaoFilter.orgaos.map((o) => (
                  <Link
                    key={o}
                    href={buildFilterUrl(categoria, currentParams, { orgao: o, page: 1 })}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      orgaoFilter === o ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
                    }`}
                  >
                    {o}
                  </Link>
                ))}
              </div>
            )}

            {hasActiveFilter && (
              <div className="pt-1">
                <Link
                  href={`/base-conhecimento/${categoria}`}
                  className="text-xs font-medium text-gray-500 hover:text-brand-700 underline"
                >
                  Limpar todos os filtros
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Disclaimer pra ONs */}
        {categoria === 'orientacoes-normativas' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 leading-relaxed">
              <p className="font-semibold mb-1">Texto oficial</p>
              <p>
                Os enunciados abaixo reproduzem a redação oficial publicada pela AGU. Para o link
                no DOU de cada orientação (em consolidação), abra o documento individual.
              </p>
            </div>
          </div>
        )}

        {docs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <p className="text-gray-600">
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
                    className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-brand-400 hover:shadow-md transition-all group focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      {enteTag && (
                        <span className="inline-block px-2 py-0.5 bg-brand-50 text-brand-700 text-xs font-semibold rounded-md mt-0.5">
                          {enteTag}
                        </span>
                      )}
                      {tipoLabel && (
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md mt-0.5">
                          {tipoLabel}
                        </span>
                      )}
                      {v === 'revogado' && (
                        <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wide rounded-md mt-0.5">
                          Revogado
                        </span>
                      )}
                      {v === 'modificado' && (
                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wide rounded-md mt-0.5">
                          Modificado
                        </span>
                      )}
                      <h2 className="text-base md:text-lg font-semibold text-gray-900 group-hover:text-brand-700 transition-colors leading-snug flex-1 basis-full sm:basis-auto">
                        {doc.title}
                      </h2>
                    </div>
                    {cfg.showDescription && doc.description && (
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 ml-0">
                        {doc.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
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
                className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-brand-400 hover:text-brand-700"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Link>
            )}
            <span className="px-4 py-2 text-sm text-gray-600 font-medium">
              Página {page} de {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildFilterUrl(categoria, currentParams, { page: page + 1 })}
                className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-brand-400 hover:text-brand-700"
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
