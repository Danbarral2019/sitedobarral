import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import {
  ArrowLeft, ArrowRight, FileText, BookOpen, List, Book, Search, ChevronLeft, ChevronRight, AlertTriangle, ClipboardList, FileSignature,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';

export const revalidate = 3600;

type CategoryConfig = {
  slug: string;
  label: string;
  description: string;
  icon: typeof FileText;
  dbCategories: readonly string[];
  orderBy: 'recent' | 'numeroDecrescente';
  showDescription: boolean; // se false, esconde paráfrase IA na lista (ex.: ONs sem texto oficial revisado)
  enteFilter?: { entes: readonly string[]; placeholder: string }; // filtro por ente (parsed from tags)
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  pareceres: {
    slug: 'pareceres',
    label: 'Pareceres Uniformizantes',
    description:
      'Pareceres da Advocacia-Geral da União, vinculantes e do CONUNI/DECOR, consolidando entendimentos sobre licitações.',
    icon: FileText,
    dbCategories: ['parecer', 'parecer-vinculante', 'decor'],
    orderBy: 'recent',
    showDescription: true,
  },
  'notas-tecnicas': {
    slug: 'notas-tecnicas',
    label: 'Notas Técnicas',
    description:
      'Notas técnicas e jurídicas produzidas pelo CONUNI/AGU em resposta a consultas dos órgãos federais.',
    icon: ClipboardList,
    dbCategories: ['nota-tecnica'],
    orderBy: 'recent',
    showDescription: true,
  },
  despachos: {
    slug: 'despachos',
    label: 'Despachos',
    description:
      'Despachos uniformizadores e cotas do CONUNI/AGU sobre matérias de licitação e contratos.',
    icon: FileSignature,
    dbCategories: ['despacho'],
    orderBy: 'recent',
    showDescription: true,
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
  searchParams: Promise<{ page?: string; q?: string; ente?: string }>;
}

export async function generateStaticParams() {
  return Object.keys(CATEGORY_CONFIG).map((categoria) => ({ categoria }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoria } = await params;
  // Acórdãos do TCU agora vivem em /jurisprudencia (não duplicar)
  if (categoria === 'acordaos') {
    return { title: 'Redirecionando…' };
  }
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

export default async function CategoriaPage({ params, searchParams }: PageProps) {
  const { categoria } = await params;

  // Acórdãos TCU já vivem em /jurisprudencia — redirecionar
  if (categoria === 'acordaos') {
    redirect('/jurisprudencia');
  }

  const { page: pageStr, q, ente } = await searchParams;
  const cfg = CATEGORY_CONFIG[categoria];

  if (!cfg) notFound();

  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;
  const searchTerm = q?.trim() || '';
  const enteFilter = cfg.enteFilter && ente && cfg.enteFilter.entes.includes(ente) ? ente : '';

  const where = {
    isPublic: true,
    category: { in: [...cfg.dbCategories] },
    ...(searchTerm && {
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' as const } },
        { description: { contains: searchTerm, mode: 'insensitive' as const } },
      ],
    }),
    // Filtro por ente: tags é JSON-stringified array; usar contains com aspas pra reduzir falsos positivos
    ...(enteFilter && {
      tags: { contains: `"${enteFilter}"` },
    }),
  };

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

  // Extrai vigência do aiClassification JSON (preenchido pelo sync CONUNI)
  function getVigencia(aiCls: string | null): 'revogado' | 'modificado' | null {
    if (!aiCls) return null;
    try {
      const parsed = JSON.parse(aiCls) as { vigencia?: string };
      if (parsed.vigencia === 'revogado') return 'revogado';
      if (parsed.vigencia === 'modificado') return 'modificado';
      return null;
    } catch { return null; }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const Icon = cfg.icon;

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

      {/* Busca + lista */}
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
          {enteFilter && <input type="hidden" name="ente" value={enteFilter} />}
        </form>

        {/* Filtro por ente (só aparece se a categoria define enteFilter) */}
        {cfg.enteFilter && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 font-medium mr-1">Ente:</span>
            <Link
              href={`/base-conhecimento/${categoria}${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ''}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !enteFilter
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
              }`}
            >
              Todos
            </Link>
            {cfg.enteFilter.entes.map((e) => (
              <Link
                key={e}
                href={`/base-conhecimento/${categoria}?${new URLSearchParams({
                  ...(searchTerm && { q: searchTerm }),
                  ente: e,
                }).toString()}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  enteFilter === e
                    ? 'bg-brand-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:border-brand-400'
                }`}
              >
                {e}
              </Link>
            ))}
          </div>
        )}

        {/* Disclaimer pra ONs: texto extraído da listagem oficial AGU; URLs DOU específicas em consolidação */}
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
              {searchTerm || enteFilter
                ? `Nenhum documento encontrado${searchTerm ? ` para "${searchTerm}"` : ''}${enteFilter ? ` no ente ${enteFilter}` : ''}.`
                : 'Nenhum documento disponível nesta categoria no momento.'}
            </p>
            {(searchTerm || enteFilter) && (
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
              // Extrai ente das tags (ex.: ["IBDA","Enunciado",...] → "IBDA")
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
              return (
                <li key={doc.id}>
                  <Link
                    href={`/documento/${doc.id}`}
                    className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-brand-400 hover:shadow-md transition-all group focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start gap-3 mb-1">
                      {enteTag && (
                        <span className="inline-block px-2 py-0.5 bg-brand-50 text-brand-700 text-xs font-semibold rounded-md flex-shrink-0 mt-0.5">
                          {enteTag}
                        </span>
                      )}
                      {(() => {
                        const v = getVigencia(doc.aiClassification);
                        if (v === 'revogado') {
                          return (
                            <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wide rounded-md flex-shrink-0 mt-0.5">
                              Revogado
                            </span>
                          );
                        }
                        if (v === 'modificado') {
                          return (
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wide rounded-md flex-shrink-0 mt-0.5">
                              Modificado
                            </span>
                          );
                        }
                        return null;
                      })()}
                      <h2 className="text-base md:text-lg font-semibold text-gray-900 group-hover:text-brand-700 transition-colors leading-snug flex-1">
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
                href={`/base-conhecimento/${categoria}?${new URLSearchParams({
                  ...(searchTerm && { q: searchTerm }),
                  ...(enteFilter && { ente: enteFilter }),
                  page: String(page - 1),
                }).toString()}`}
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
                href={`/base-conhecimento/${categoria}?${new URLSearchParams({
                  ...(searchTerm && { q: searchTerm }),
                  ...(enteFilter && { ente: enteFilter }),
                  page: String(page + 1),
                }).toString()}`}
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
