import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { ArrowRight, BookOpen, Star, Scale, BookMarked, FileCheck, Landmark, ScrollText, Gavel, FileText, Building2 } from 'lucide-react';
import NewsletterForm from '@/components/NewsletterForm';
import HomeNovidadesSection from '@/components/HomeNovidadesSection';
import {
  getCachedDocumentCountByCategory,
  getCachedLeiArticleCount,
  getCachedGlossaryTermCount,
  getCachedLegislativeActCount,
  getCachedTribunalDecisionCount,
} from '@/lib/cached-queries';

// Revalidate every 1 hour so novidades section stays fresh
export const revalidate = 3600;

// Lazy load do carrossel de depoimentos (otimização de performance)
const TestimonialsCarousel = dynamic(() => import('@/components/TestimonialsCarousel'), {
  loading: () => (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  ),
  ssr: true
});

export default async function Home() {
  let categoryCounts: Record<string, number> = {};
  let leiArticleCount = 195;
  let glossaryCount = 95;
  let legislativeActCount = 53;
  let tribunalDecisionCount = 0;

  try {
    [categoryCounts, leiArticleCount, glossaryCount, legislativeActCount, tribunalDecisionCount] = await Promise.all([
      getCachedDocumentCountByCategory(),
      getCachedLeiArticleCount(),
      getCachedGlossaryTermCount(),
      getCachedLegislativeActCount(),
      getCachedTribunalDecisionCount(),
    ]);
  } catch {
    // DB unavailable (e.g. CI build) — use defaults
  }

  const acervoCounts = [
    {
      label: 'Acórdãos TCU',
      count: categoryCounts['acordao'] || 0,
      icon: Gavel,
      href: '/jurisprudencia',
    },
    {
      label: 'Pareceres, Notas e Despachos',
      count:
        (categoryCounts['parecer'] || 0) +
        (categoryCounts['parecer-vinculante'] || 0) +
        (categoryCounts['nota-tecnica'] || 0) +
        (categoryCounts['despacho'] || 0) +
        (categoryCounts['decor'] || 0),
      icon: FileCheck,
      href: '/base-conhecimento/pareceres',
    },
    {
      label: 'Orientações Normativas',
      count: categoryCounts['orientacao-normativa'] || 0,
      icon: ScrollText,
      href: '/base-conhecimento/orientacoes-normativas',
    },
    {
      label: 'Enunciados',
      count: categoryCounts['enunciados'] || 0,
      icon: BookMarked,
      href: '/base-conhecimento/enunciados',
    },
    {
      label: 'Artigos da Lei 14.133',
      count: leiArticleCount,
      icon: Scale,
      href: '/lei-14133',
    },
    {
      label: 'Atos Normativos',
      count: legislativeActCount,
      icon: FileText,
      href: '/legislacao',
    },
    {
      label: 'Termos no Glossário',
      count: glossaryCount,
      icon: Landmark,
      href: '/glossario',
    },
    {
      label: 'Decisões TCEs e CNJ',
      count: tribunalDecisionCount,
      icon: Building2,
      href: '/jurisprudencia',
    },
  ];

  const totalDocuments = Object.values(categoryCounts).reduce((sum, c) => sum + c, 0) + tribunalDecisionCount;

  return (
    <main>
      {/* 1. Hero Section */}
      <section className="text-white py-20 relative overflow-hidden bg-gradient-to-b from-brand-600 via-brand-600 to-brand-700">
        <div className="container mx-auto px-4">
          <div className="relative max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-center">
              <div className="lg:col-span-8 relative z-10 text-center lg:text-left">
                <div className="bg-gradient-to-r from-brand-700/95 via-brand-700/90 to-transparent lg:py-12 lg:pl-8 lg:pr-16 rounded-2xl lg:backdrop-blur-sm">
                  <h1 className="text-4xl md:text-5xl font-cinzel font-semibold mb-6 tracking-wide">
                    Prof. Daniel Barral
                  </h1>
                  <p className="text-xl md:text-2xl mb-4 font-poppins font-normal">
                    Professor | Mestre em Direito Público
                  </p>
                  <p className="text-lg mb-8 text-brand-100 font-poppins">
                    Especialista em Licitações e Contratos Administrativos
                  </p>
                  <p className="text-lg mb-10 max-w-2xl mx-auto lg:mx-0 text-brand-100/90 font-poppins leading-relaxed">
                    Repositório especializado de materiais jurídicos em Direito Administrativo,
                    com foco em fortalecer seu conhecimento e aprimorar suas atividades funcionais.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    <Link
                      href="/cursos"
                      className="bg-white text-brand-700 px-8 py-3 rounded-lg font-poppins font-semibold hover:bg-brand-50 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <BookOpen className="w-5 h-5" />
                      Explorar Cursos
                    </Link>
                    <Link
                      href="/login"
                      className="bg-blue-600 text-white px-8 py-3 rounded-lg font-poppins font-semibold hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2 border border-blue-500"
                    >
                      Área do Aluno
                      <ArrowRight className="w-5 h-5 text-white" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 relative lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2 lg:w-[55%] hidden lg:block">
                <div className="relative h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl">
                  <Image
                    src="/images/professor/banner-home.jpg"
                    alt="Prof. Daniel Barral"
                    fill
                    className="object-cover object-[40%_center]"
                    sizes="(max-width: 1023px) 0px, 55vw"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Numeros / Acervo */}
      <section className="py-16 bg-gradient-to-b from-brand-700 to-brand-800 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-cinzel font-semibold mb-3">
                Base de Conhecimento
              </h2>
              <p className="text-brand-200 font-poppins text-lg">
                Mais de {totalDocuments > 0 ? totalDocuments.toLocaleString('pt-BR') : '2.000'} documentos jurídicos atualizados constantemente
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {acervoCounts.map((item) => {
                const Icon = item.icon;
                const content = (
                  <>
                    <Icon className="w-7 h-7 mx-auto mb-3 text-brand-200" />
                    <p className="text-3xl md:text-4xl font-bold text-white mb-1">
                      {item.count > 0 ? item.count.toLocaleString('pt-BR') : '--'}
                    </p>
                    <p className="text-sm text-brand-200 font-poppins leading-tight">
                      {item.label}
                    </p>
                  </>
                );
                const baseClassName = `bg-white/10 backdrop-blur-sm rounded-xl p-5 text-center border border-white/10 hover:bg-white/15 transition-colors ${item.href ? 'cursor-pointer hover:border-white/30 hover:scale-[1.02] transition-all' : ''}`;
                return item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={baseClassName}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={item.label}
                    className={baseClassName}
                  >
                    {content}
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-8">
              <Link
                href="/busca"
                className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/25 transition-colors border border-white/20"
              >
                Pesquisar no Acervo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Novidades + Blog */}
      <Suspense fallback={null}>
        <HomeNovidadesSection />
      </Suspense>

      {/* 4. Depoimentos */}
      <section className="py-16 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Depoimentos de Alunos</h2>
              <div className="h-1 w-24 bg-gradient-to-r from-accent-400 to-accent-500 rounded-full mx-auto"></div>
            </div>

            <TestimonialsCarousel />

            <div className="text-center mt-10">
              <p className="text-gray-700 mb-4 text-lg">
                Você também é aluno e quer compartilhar sua experiência?
              </p>
              <Link
                href="/contato?motivo=depoimento"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <Star className="w-5 h-5 fill-white" />
                Enviar Meu Depoimento
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Newsletter */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 rounded-2xl p-10 md:p-12 text-center shadow-2xl border-4 border-blue-700">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE0YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0yNCAzOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"></div>

              <div className="relative z-10">
                <div className="inline-block mb-4">
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white font-semibold text-sm">Newsletter Jurídica</span>
                  </div>
                </div>

                <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                  Mantenha-se Atualizado
                </h2>
                <p className="text-xl text-white mb-10 max-w-2xl mx-auto leading-relaxed">
                  Cadastre-se em nossa newsletter e receba novidades sobre legislação,
                  jurisprudência e novos materiais disponíveis.
                </p>

                <div className="max-w-xl mx-auto bg-white/10 backdrop-blur-md p-2 rounded-2xl border-2 border-white/30">
                  <NewsletterForm variant="inline" className="[&_input]:bg-white [&_input]:text-gray-900 [&_input]:placeholder:text-gray-500 [&_input]:font-medium [&_input]:text-lg [&_input]:focus:ring-white/50 [&_input]:border-0 [&_button]:bg-accent-400 [&_button]:text-gray-900 [&_button]:font-bold [&_button]:hover:bg-accent-500 [&_button]:shadow-xl" />
                </div>

                <p className="text-white/80 text-sm mt-4">
                  Sem spam · Cancele quando quiser · Conteúdo exclusivo
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Botao Admin - Discreto */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Área Administrativa
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
