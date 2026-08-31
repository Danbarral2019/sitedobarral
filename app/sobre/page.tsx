import { Award, BookOpen, Users, Briefcase, GraduationCap, Scale, ArrowRight, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sobre o Prof. Daniel Barral',
  description: 'Mestre em Direito Público, Professor Especializado em Licitações e Contratos Administrativos. Conheça a trajetória profissional e acadêmica do Prof. Daniel Barral.',
  keywords: [
    'Daniel Barral',
    'professor direito administrativo',
    'mestre direito público',
    'especialista licitações',
    'contratos administrativos',
    'AGU',
    'TCU',
    'perfil profissional',
  ],
  openGraph: {
    title: 'Sobre o Prof. Daniel Barral',
    description: 'Mestre em Direito Público, Professor Especializado em Licitações e Contratos Administrativos',
    url: 'https://profdanielbarral.com/sobre',
    type: 'profile',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sobre o Prof. Daniel Barral',
    description: 'Mestre em Direito Público, Professor Especializado em Licitações e Contratos Administrativos',
  },
  alternates: {
    canonical: '/sobre',
  },
};

export default function SobrePage() {
  return (
    <main className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block">
              <h1 className="text-5xl font-bold mb-3 text-ink-primary font-cinzel">Prof. Daniel Barral</h1>
              <div className="h-1.5 w-48 bg-brand-500 rounded-full mx-auto mb-6"></div>
            </div>
            <p className="text-xl text-ink-secondary leading-relaxed">
              Mestre em Direito Público e Professor Especializado em Licitações e Contratos Administrativos
            </p>
          </div>

          {/* Bio Section */}
          <div className="bg-white rounded-[6px] p-8 mb-8 border-2 border-border-subtle hover:border-brand-400 hover: transition-all">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
              <div className="relative group">
                <div className="w-64 h-64 relative rounded-[6px] overflow-hidden ring-4 ring-brand-100 group-hover:ring-brand-300 transition-all">
                  <Image
                    src="/images/professor/sobre.jpg"
                    alt="Prof. Daniel Barral"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div className="absolute -bottom-3 -right-3 w-16 h-16 bg-brand-600 rounded-full flex items-center justify-center border border-border-subtle">
                  <Scale className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="inline-block mb-4">
                  <h2 className="text-2xl font-bold mb-2 text-ink-primary">Perfil Profissional</h2>
                  <div className="h-1 w-24 bg-brand-500 rounded-full"></div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-brand-100 p-3 rounded-[6px] border-l-4 border-brand-500">
                    <div className="w-10 h-10 bg-brand-600 rounded-[6px] flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="text-white" size={20} />
                    </div>
                    <span className="text-ink-primary font-semibold">Mestre em Direito Público</span>
                  </div>
                  <div className="flex items-center gap-3 bg-brand-100 p-3 rounded-[6px] border-l-4 border-brand-500">
                    <div className="w-10 h-10 bg-white border-4 border-brand-500 rounded-[6px] flex items-center justify-center flex-shrink-0">
                      <BookOpen className="text-brand-600" size={20} />
                    </div>
                    <span className="text-ink-primary font-semibold">Professor de Licitações e Contratos</span>
                  </div>
                  <div className="flex items-center gap-3 bg-surface-raised p-3 rounded-[6px] border-l-4 border-border-strong">
                    <div className="w-10 h-10 bg-brand-800 rounded-[6px] flex items-center justify-center flex-shrink-0">
                      <Briefcase className="text-white" size={20} />
                    </div>
                    <span className="text-ink-primary font-semibold">Palestrante Especializado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mission Section */}
          <div className="relative overflow-hidden mb-8">
            <div className="absolute inset-0 bg-brand-600 opacity-95"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0yNCAzOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
            <div className="relative p-10 md:p-12 text-center rounded-[6px]">
              <div className="inline-block mb-4">
                <div className="bg-white/20 px-4 py-2 rounded-full">
                  <span className="text-white font-semibold text-sm flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Nossa Missão
                  </span>
                </div>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Missão</h2>
              <p className="text-xl text-white leading-relaxed max-w-3xl mx-auto opacity-95">
                &quot;Compartilhar conhecimento prático e atualizado em Direito Administrativo,
                contribuindo para a excelência na gestão pública e o aprimoramento contínuo
                dos profissionais que atuam com licitações e contratos.&quot;
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-6">
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Conteúdo Atualizado</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Foco Prático</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Excelência Profissional</span>
                </div>
              </div>
            </div>
          </div>

          {/* Areas of Expertise */}
          <div className="bg-white rounded-[6px] p-8 mb-8 border-2 border-border-subtle hover: transition-all">
            <div className="inline-block mb-6">
              <h2 className="text-2xl font-bold mb-2 text-ink-primary">Áreas de Especialização</h2>
              <div className="h-1 w-32 bg-brand-500 rounded-full"></div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4 bg-brand-50 p-4 rounded-[6px] border-l-4 border-brand-500 hover: transition-all group">
                  <div className="w-12 h-12 bg-brand-600 rounded-[6px] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Scale className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink-primary mb-1">Direito Administrativo</h3>
                    <p className="text-ink-secondary text-sm leading-relaxed">Atuação especializada em todos os aspectos do Direito Administrativo, com foco em aplicação prática</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-brand-50 p-4 rounded-[6px] border-l-4 border-brand-500 hover: transition-all group">
                  <div className="w-12 h-12 bg-white border-4 border-brand-500 rounded-[6px] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <BookOpen className="text-brand-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink-primary mb-1">Licitações e Contratos</h3>
                    <p className="text-ink-secondary text-sm leading-relaxed">Especialista na Nova Lei de Licitações (Lei nº 14.133/2021) e gestão de contratos administrativos</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-4 bg-surface-raised p-4 rounded-[6px] border-l-4 border-border-strong hover: transition-all group">
                  <div className="w-12 h-12 bg-brand-800 rounded-[6px] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Briefcase className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink-primary mb-1">Processo Administrativo</h3>
                    <p className="text-ink-secondary text-sm leading-relaxed">Conhecimento aprofundado em processos administrativos e procedimentos sancionadores</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-brand-100 p-4 rounded-[6px] border-l-4 border-brand-600 hover: transition-all group">
                  <div className="w-12 h-12 bg-brand-700 rounded-[6px] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Award className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink-primary mb-1">Inovação nas Contratações</h3>
                    <p className="text-ink-secondary text-sm leading-relaxed">Orientação sobre novas modalidades e tecnologias aplicadas às contratações públicas</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Education and Professional Experience */}
          <div className="bg-white rounded-[6px] p-8 mb-8 border-2 border-border-subtle hover: transition-all">
            <div className="inline-block mb-6">
              <h2 className="text-2xl font-bold mb-2 text-ink-primary">Formação e Experiência Profissional</h2>
              <div className="h-1 w-40 bg-brand-500 rounded-full"></div>
            </div>

            <div className="space-y-8">
              <div className="bg-brand-50 p-6 rounded-[6px] border-l-4 border-brand-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-brand-600 rounded-[6px] flex items-center justify-center">
                    <GraduationCap className="text-white" size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-ink-primary">Formação Acadêmica</h3>
                </div>
                <div className="space-y-4 text-ink-secondary">
                  <p className="leading-relaxed">
                    <strong>Graduado em Direito</strong> pela Universidade Católica do Salvador (2004), desenvolveu sólida especialização em direito público através de formação continuada que inclui:
                  </p>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-brand-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="leading-relaxed"><strong>Especialização em Direito Público</strong> pela Universidade Anhanguera-UNIDERP (2009)</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-brand-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="leading-relaxed"><strong>LLM em Direito Empresarial</strong> pela Fundação Getúlio Vargas (2015)</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-brand-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="leading-relaxed"><strong>Mestrado em Direito Público</strong> pela Universidade Nova de Lisboa (2022)</p>
                    </div>
                  </div>
                  <p className="mt-4 leading-relaxed bg-white/50 p-3 rounded-[6px]">
                    Sua dissertação de mestrado investigou a legitimação do direito regulador através de processos administrativos democráticos, com foco nos acordos integrativos em contratos de concessão durante a pandemia de Covid-19.
                  </p>
                </div>
              </div>

              <div className="bg-brand-50 p-6 rounded-[6px] border-l-4 border-brand-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white border-4 border-brand-500 rounded-[6px] flex items-center justify-center">
                    <Briefcase className="text-brand-600" size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-ink-primary">Experiência como Procurador Federal</h3>
                </div>
                <div className="space-y-4 text-ink-secondary">
                  <p className="leading-relaxed">
                    Como <strong>Procurador Federal da classe Especial desde 2008</strong>, acumulou dezesseis anos de experiência em consultoria jurídica especializada, desenvolvendo capacidade analítica apurada através da atuação em diferentes setores da administração federal.
                  </p>
                  <p className="leading-relaxed">
                    Essa trajetória proporcionou visão sistêmica dos desafios regulatórios contemporâneos, particularmente em áreas como infraestrutura, transportes, proteção de dados e parcerias público-privadas.
                  </p>
                </div>
              </div>

              <div className="bg-surface-raised p-6 rounded-[6px] border-l-4 border-border-strong">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-brand-800 rounded-[6px] flex items-center justify-center">
                    <BookOpen className="text-white" size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-ink-primary">Atividades Acadêmicas e Docência</h3>
                </div>
                <div className="space-y-4 text-ink-secondary">
                  <p className="leading-relaxed">
                    Combina a prática jurídica com atividades acadêmicas em diversas instituições públicas e privadas como a <strong>Esafi, Inove, Escola Nacional de Administração Pública (ENAP), Escola da AGU e grupo educacional Damásio</strong>.
                  </p>
                  <p className="leading-relaxed">
                    Fundou o <strong>Portal L&C</strong> e participou ativamente de grupos de trabalho institucionais voltados à padronização de procedimentos jurídicos, incluindo atuação na Câmara Permanente de Licitações e Contratos da PGF.
                  </p>
                  <p className="leading-relaxed">
                    Ministra regularmente palestras e cursos para órgãos públicos desde 2010, consolidando reconhecimento em licitações, contratos administrativos e direito regulatório.
                  </p>
                </div>
              </div>

              <div className="bg-brand-100 p-6 rounded-[6px] border-l-4 border-brand-600">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-brand-700 rounded-[6px] flex items-center justify-center">
                    <Users className="text-white" size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-ink-primary">Participação Institucional</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-5 rounded-[6px] border-2 border-brand-200 hover:border-brand-400 transition-all hover:">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-brand-600 rounded-full"></div>
                      <h4 className="font-bold text-ink-primary">INCP</h4>
                    </div>
                    <p className="text-sm text-ink-secondary leading-relaxed">Membro do Instituto Nacional de Concurso Público</p>
                  </div>
                  <div className="bg-white p-5 rounded-[6px] border-2 border-brand-200 hover:border-brand-400 transition-all hover:">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-brand-600 rounded-full"></div>
                      <h4 className="font-bold text-ink-primary">IDASAN</h4>
                    </div>
                    <p className="text-sm text-ink-secondary leading-relaxed">Membro do Instituto de Direito Administrativo Sancionador Brasileiro</p>
                  </div>
                </div>
                <p className="text-ink-secondary leading-relaxed">
                  Organizações que refletem seu compromisso com o desenvolvimento das práticas administrativas e do direito administrativo sancionador brasileiro.
                </p>
              </div>
            </div>
          </div>

          {/* Public Target */}
          <div className="bg-white rounded-[6px] p-8 mb-8 border-2 border-border-subtle">
            <div className="inline-block mb-6">
              <h2 className="text-2xl font-bold mb-2 text-ink-primary">Público-Alvo</h2>
              <div className="h-1 w-24 bg-brand-500 rounded-full"></div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-brand-50 p-6 rounded-[6px] border-2 border-brand-200 hover:border-brand-400 hover: transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-brand-600 rounded-[6px] flex items-center justify-center">
                    <Users className="text-white" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-ink-primary">Perfil Principal</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-ink-primary font-medium leading-relaxed">Servidores públicos (ativos ou futuros)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-ink-primary font-medium leading-relaxed">Profissionais de nível iniciante a avançado</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-ink-primary font-medium leading-relaxed">Foco no aprimoramento das atividades funcionais</span>
                  </li>
                </ul>
              </div>
              <div className="bg-brand-50 p-6 rounded-[6px] border-2 border-brand-200 hover:border-brand-400 hover: transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white border-4 border-brand-500 rounded-[6px] flex items-center justify-center">
                    <Scale className="text-brand-600" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-ink-primary">Perfil Secundário</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-ink-primary font-medium leading-relaxed">Advogados especializados em Direito Público</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-ink-primary font-medium leading-relaxed">Concurseiros de nível superior</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-ink-primary font-medium leading-relaxed">Procuradores e operadores do direito</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-brand-600 opacity-95"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0yNCAzOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
            <div className="relative p-10 md:p-12 text-center rounded-[6px]">
              <div className="inline-block mb-4">
                <div className="bg-white/20 px-4 py-2 rounded-full">
                  <span className="text-white font-semibold text-sm">💼 Próximos Passos</span>
                </div>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                Conheça Nossos Cursos
              </h2>
              <p className="text-xl text-white mb-8 max-w-2xl mx-auto leading-relaxed opacity-95">
                Explore nossa biblioteca completa de cursos especializados em Direito Administrativo,
                Licitações e Contratos Públicos
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/cursos"
                  className="inline-flex items-center gap-3 bg-white text-ink-primary px-10 py-5 rounded-[6px] text-lg font-bold hover:bg-surface-raised transition-all hover:scale-105 border border-border-subtle"
                  aria-label="Ver todos os cursos disponíveis"
                >
                  <BookOpen className="w-6 h-6" />
                  Ver Cursos
                  <ArrowRight className="w-6 h-6" />
                </Link>
                <Link
                  href="/contato"
                  className="inline-flex items-center gap-3 bg-white/15 border-2 border-white/40 text-white px-10 py-5 rounded-[6px] text-lg font-bold hover:bg-white/25 transition-all hover:scale-105"
                  aria-label="Entre em contato conosco"
                >
                  Entre em Contato
                  <ArrowRight className="w-6 h-6" />
                </Link>
              </div>
              <p className="text-white/90 text-sm mt-6">
                ✓ 7 Cursos Especializados · ✓ Material Atualizado · ✓ Foco Prático
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}