import Link from 'next/link';
import { Scale, FileText, BookOpen, List, Book, Landmark, Sparkles, Library, Briefcase, BookMarked, Gavel } from 'lucide-react';
import {
  getCachedDocumentCountByCategory,
  getCachedTribunalDecisionCount,
  getCachedLeiArticleCount,
  getCachedGlossaryTermCount,
  getCachedTstSumulaCount,
  getCachedTstOjCount,
  getCachedTstPnCount,
} from '@/lib/cached-queries';
import { getSiteUrl } from '@/lib/site-url';

// 60s: contadores mudam quando admin classifica/sync roda — atualiza rápido
export const revalidate = 60;

export const metadata = {
  title: 'Base de Conhecimento',
  description:
    'Centro de conhecimento em Direito Administrativo, Licitações e Contratos: acórdãos do TCU, pareceres uniformizantes, orientações normativas, enunciados, Lei 14.133 comentada e jurisprudência consolidada.',
  alternates: {
    canonical: new URL('/base-conhecimento', getSiteUrl()),
  },
};

const PARECER_CATEGORIES = ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] as const;

type CategoryConfig = {
  key: string;
  label: string;
  description: string;
  icon: typeof Scale;
  href: string;
  matchCategories?: readonly string[];
};

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'lei-14133',
    label: 'Lei 14.133/2021 — Comentada',
    description: 'Nova Lei de Licitações artigo por artigo, navegação temática.',
    icon: Library,
    href: '/lei-14133',
  },
  {
    key: 'acordao',
    label: 'Acórdãos do TCU',
    description: 'Jurisprudência selecionada do Tribunal de Contas da União.',
    icon: Scale,
    href: '/jurisprudencia',
  },
  {
    key: 'pareceres',
    label: 'Pareceres, Notas e Despachos',
    description: 'Manifestações da AGU (CONUNI/DECOR) — pareceres uniformizantes, vinculantes, notas técnicas e despachos.',
    icon: FileText,
    href: '/base-conhecimento/pareceres',
    matchCategories: PARECER_CATEGORIES,
  },
  {
    key: 'orientacao-normativa',
    label: 'Orientações Normativas',
    description: 'ONs da AGU consolidadas e atualizadas.',
    icon: BookOpen,
    href: '/base-conhecimento/orientacoes-normativas',
  },
  {
    key: 'enunciados',
    label: 'Enunciados',
    description: 'Enunciados do CJF, IBDA e INCP, aprovados em simpósios e jornadas técnicas.',
    icon: List,
    href: '/base-conhecimento/enunciados',
  },
  {
    key: 'manual-tcu',
    label: 'Manual de Licitações do TCU',
    description: 'Manual oficial do TCU, totalmente indexado.',
    icon: Book,
    href: '/base-conhecimento/manual-tcu',
  },
];

export default async function BaseConhecimentoPage() {
  let categoryCounts: Record<string, number> = {};
  let tribunalDecisionCount = 0;
  let leiArticleCount = 195;
  let glossaryCount = 95;
  let tstSumulaCount = 0;
  let tstOjCount = 0;
  let tstPnCount = 0;

  try {
    [
      categoryCounts,
      tribunalDecisionCount,
      leiArticleCount,
      glossaryCount,
      tstSumulaCount,
      tstOjCount,
      tstPnCount,
    ] = await Promise.all([
      getCachedDocumentCountByCategory(),
      getCachedTribunalDecisionCount(),
      getCachedLeiArticleCount(),
      getCachedGlossaryTermCount(),
      getCachedTstSumulaCount(),
      getCachedTstOjCount(),
      getCachedTstPnCount(),
    ]);
  } catch {
    // DB indisponível (ex.: build CI) — usa defaults
  }

  // `tribunalDecisionCount` inclui todos os tipos TST (Súmulas + OJs + PNs).
  // Subtraímos para evitar dupla-contagem (cada série tem card próprio).
  const tstTotal = tstSumulaCount + tstOjCount + tstPnCount;
  const tribunalOthersCount = Math.max(0, tribunalDecisionCount - tstTotal);

  const cardsWithCounts = CATEGORIES.map((cat) => {
    if (cat.key === 'lei-14133') {
      return { ...cat, count: leiArticleCount, suffix: leiArticleCount === 1 ? 'artigo' : 'artigos' };
    }
    const mc = cat.matchCategories;
    const count = mc
      ? mc.reduce((s, c) => s + (categoryCounts[c] || 0), 0)
      : categoryCounts[cat.key] || 0;
    return { ...cat, count, suffix: count === 1 ? 'documento' : 'documentos' };
  }).filter((cat) => cat.count > 0);

  const totalDocs =
    Object.values(categoryCounts).reduce((s, c) => s + c, 0) + tribunalDecisionCount;

  return (
    <main className="min-h-screen bg-surface-raised">
      {/* Hero */}
      <section className="bg-brand-700 text-white py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-heading font-semibold mb-4 tracking-wide">
              Base de Conhecimento
            </h1>
            <p className="text-lg md:text-xl text-brand-100 font-sans leading-relaxed">
              {totalDocs > 0
                ? `${totalDocs.toLocaleString('pt-BR')} documentos especializados`
                : 'Repositório especializado'}{' '}
              em Direito Administrativo, Licitações e Contratos.
            </p>
          </div>
        </div>
      </section>

      {/* Grid de categorias */}
      <section className="container mx-auto px-4 py-12 md:py-16 max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cardsWithCounts.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.key}
                href={cat.href}
                className="bg-white border border-border-subtle rounded-[6px] p-6 hover:border-brand-400 hover: transition-all group focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <div className="w-12 h-12 bg-brand-100 rounded-[6px] flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
                  <Icon className="w-6 h-6 text-brand-700" />
                </div>
                <h2 className="text-lg font-bold text-ink-primary mb-1 group-hover:text-brand-700 transition-colors">
                  {cat.label}
                </h2>
                <p className="text-sm text-ink-muted mb-2 leading-relaxed">{cat.description}</p>
                <p className="text-xs font-semibold text-brand-700">
                  {cat.count.toLocaleString('pt-BR')} {cat.suffix}
                </p>
              </Link>
            );
          })}

          {tribunalOthersCount > 0 && (
            <Link
              href="/jurisprudencia"
              className="bg-white border border-border-subtle rounded-[6px] p-6 hover:border-brand-400 hover: transition-all group focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <div className="w-12 h-12 bg-brand-100 rounded-[6px] flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
                <Landmark className="w-6 h-6 text-brand-700" />
              </div>
              <h2 className="text-lg font-bold text-ink-primary mb-1 group-hover:text-brand-700 transition-colors">
                Jurisprudência (TCEs e CNJ)
              </h2>
              <p className="text-sm text-ink-muted mb-2 leading-relaxed">
                Decisões selecionadas dos Tribunais de Contas estaduais e do CNJ.
              </p>
              <p className="text-xs font-semibold text-brand-700">
                {tribunalOthersCount.toLocaleString('pt-BR')}{' '}
                {tribunalOthersCount === 1 ? 'decisão' : 'decisões'}
              </p>
            </Link>
          )}

          {tstSumulaCount > 0 && (
            <Link
              href="/jurisprudencia?tribunal=TST&decisionType=sumula"
              className="bg-white border border-border-subtle rounded-[6px] p-6 hover:border-brand-400 hover: transition-all group focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <div className="w-12 h-12 bg-brand-100 rounded-[6px] flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
                <Briefcase className="w-6 h-6 text-brand-700" />
              </div>
              <h2 className="text-lg font-bold text-ink-primary mb-1 group-hover:text-brand-700 transition-colors">
                Súmulas do TST
              </h2>
              <p className="text-sm text-ink-muted mb-2 leading-relaxed">
                Jurisprudência consolidada do Tribunal Superior do Trabalho — relevante em terceirização, fiscalização de contratos e repactuação.
              </p>
              <p className="text-xs font-semibold text-brand-700">
                {tstSumulaCount.toLocaleString('pt-BR')}{' '}
                {tstSumulaCount === 1 ? 'súmula' : 'súmulas'}
              </p>
            </Link>
          )}

          {tstOjCount > 0 && (
            <Link
              href="/jurisprudencia?tribunal=TST&decisionType=orientacao_jurisprudencial"
              className="bg-white border border-border-subtle rounded-[6px] p-6 hover:border-brand-400 hover: transition-all group focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <div className="w-12 h-12 bg-brand-100 rounded-[6px] flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
                <BookMarked className="w-6 h-6 text-brand-700" />
              </div>
              <h2 className="text-lg font-bold text-ink-primary mb-1 group-hover:text-brand-700 transition-colors">
                Orientações Jurisprudenciais (TST)
              </h2>
              <p className="text-sm text-ink-muted mb-2 leading-relaxed">
                OJs das subseções SBDI-I, SBDI-I Transitória, SBDI-II e SDC, mais o Tribunal Pleno/Órgão Especial — jurisprudência consolidada das subseções especializadas.
              </p>
              <p className="text-xs font-semibold text-brand-700">
                {tstOjCount.toLocaleString('pt-BR')}{' '}
                {tstOjCount === 1 ? 'orientação' : 'orientações'}
              </p>
            </Link>
          )}

          {tstPnCount > 0 && (
            <Link
              href="/jurisprudencia?tribunal=TST&decisionType=precedente_normativo"
              className="bg-white border border-border-subtle rounded-[6px] p-6 hover:border-brand-400 hover: transition-all group focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <div className="w-12 h-12 bg-brand-100 rounded-[6px] flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
                <Gavel className="w-6 h-6 text-brand-700" />
              </div>
              <h2 className="text-lg font-bold text-ink-primary mb-1 group-hover:text-brand-700 transition-colors">
                Precedentes Normativos (TST)
              </h2>
              <p className="text-sm text-ink-muted mb-2 leading-relaxed">
                Decisões vinculantes da Seção de Dissídios Coletivos — negociação coletiva, cláusulas normativas e dissídios.
              </p>
              <p className="text-xs font-semibold text-brand-700">
                {tstPnCount.toLocaleString('pt-BR')}{' '}
                {tstPnCount === 1 ? 'precedente' : 'precedentes'}
              </p>
            </Link>
          )}

          {glossaryCount > 0 && (
            <Link
              href="/glossario"
              className="bg-white border border-border-subtle rounded-[6px] p-6 hover:border-brand-400 hover: transition-all group focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <div className="w-12 h-12 bg-brand-100 rounded-[6px] flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
                <BookOpen className="w-6 h-6 text-brand-700" />
              </div>
              <h2 className="text-lg font-bold text-ink-primary mb-1 group-hover:text-brand-700 transition-colors">
                Glossário Jurídico
              </h2>
              <p className="text-sm text-ink-muted mb-2 leading-relaxed">
                Termos técnicos da matéria explicados em linguagem clara.
              </p>
              <p className="text-xs font-semibold text-brand-700">
                {glossaryCount.toLocaleString('pt-BR')}{' '}
                {glossaryCount === 1 ? 'termo' : 'termos'}
              </p>
            </Link>
          )}
        </div>

        {/* Teaser pra alunos (modelo jurisprudência) */}
        <div className="mt-14 bg-brand-50 border border-brand-200 rounded-[6px] p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start gap-4 max-w-4xl mx-auto">
            <div className="w-12 h-12 bg-brand-600 rounded-[6px] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-ink-primary mb-2">
                Consulte com Inteligência Artificial
              </h2>
              <p className="text-ink-secondary leading-relaxed mb-5">
                Alunos têm acesso a busca semântica em todo o acervo, resumo automático de
                documentos longos, e ferramentas exclusivas de pesquisa indexada.
              </p>
              <Link
                href="/planos"
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-[6px] font-semibold hover:bg-brand-700 transition-colors border border-border-subtle"
              >
                Conhecer planos
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
