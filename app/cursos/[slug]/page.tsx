import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, Lock, FileText,
  QrCode, CheckCircle, Users,
  Clock, Award, Target, Lightbulb, Star
} from 'lucide-react';
import { courses } from '@/data/courses';
import CourseEnrollmentInfo from '@/components/CourseEnrollmentInfo';

export async function generateStaticParams() {
  return courses.map((course) => ({
    slug: course.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = courses.find((c) => c.slug === slug);

  if (!course) {
    return {
      title: 'Curso não encontrado',
    };
  }

  return {
    title: `${course.title} | Prof. Daniel Barral`,
    description: course.shortDescription || course.description.substring(0, 160),
    keywords: [
      'direito administrativo',
      'licitações',
      'contratos públicos',
      'Lei 14.133/2021',
      course.title,
      'curso online',
      'prof daniel barral',
    ].join(', '),
    authors: [{ name: 'Prof. Daniel Barral' }],
    openGraph: {
      title: course.title,
      description: course.shortDescription || course.description.substring(0, 160),
      type: 'website',
      locale: 'pt_BR',
      siteName: 'Prof. Daniel Barral - Cursos de Direito Administrativo',
    },
    twitter: {
      card: 'summary_large_image',
      title: course.title,
      description: course.shortDescription || course.description.substring(0, 160),
    },
    alternates: {
      canonical: `/cursos/${course.slug}`,
    },
  };
}

// Mapeamento de cores por ID do curso (1-10) - Paleta crescente de azul
// Hero usa cores mais escuras para contraste com texto branco
// Cards/borders usam as cores originais mais claras
const getCourseColor = (courseId: string) => {
  const colorMap: Record<string, {
    gradient: string;
    border: string;
    bg: string;
    bgLight: string;
    text: string;
    hover: string;
  }> = {
    '1': {
      gradient: 'from-blue-500 to-blue-600',  // Escurecido para melhor contraste no hero
      border: 'border-blue-300',
      bg: 'bg-blue-50',
      bgLight: 'bg-blue-100',
      text: 'text-blue-600',
      hover: 'hover:bg-blue-600',
    },
    '2': {
      gradient: 'from-blue-600 to-blue-700',  // Escurecido para melhor contraste no hero
      border: 'border-blue-400',
      bg: 'bg-blue-50',
      bgLight: 'bg-blue-100',
      text: 'text-blue-700',
      hover: 'hover:bg-blue-700',
    },
    '3': {
      gradient: 'from-blue-600 to-blue-700',
      border: 'border-blue-500',
      bg: 'bg-blue-50',
      bgLight: 'bg-blue-100',
      text: 'text-blue-700',
      hover: 'hover:bg-blue-700',
    },
    '4': {
      gradient: 'from-blue-600 to-blue-700',
      border: 'border-blue-600',
      bg: 'bg-blue-100',
      bgLight: 'bg-blue-200',
      text: 'text-blue-800',
      hover: 'hover:bg-blue-700',
    },
    '5': {
      gradient: 'from-blue-700 to-blue-800',
      border: 'border-blue-700',
      bg: 'bg-blue-100',
      bgLight: 'bg-blue-200',
      text: 'text-blue-800',
      hover: 'hover:bg-blue-800',
    },
    '6': {
      gradient: 'from-blue-800 to-blue-900',
      border: 'border-blue-800',
      bg: 'bg-blue-100',
      bgLight: 'bg-blue-200',
      text: 'text-blue-900',
      hover: 'hover:bg-blue-900',
    },
    '7': {
      gradient: 'from-sky-600 to-sky-700',
      border: 'border-sky-600',
      bg: 'bg-sky-50',
      bgLight: 'bg-sky-100',
      text: 'text-sky-800',
      hover: 'hover:bg-sky-700',
    },
    '8': {
      gradient: 'from-sky-700 to-sky-800',
      border: 'border-sky-700',
      bg: 'bg-sky-100',
      bgLight: 'bg-sky-200',
      text: 'text-sky-900',
      hover: 'hover:bg-sky-800',
    },
    '9': {
      gradient: 'from-indigo-700 to-indigo-800',
      border: 'border-indigo-700',
      bg: 'bg-indigo-50',
      bgLight: 'bg-indigo-100',
      text: 'text-indigo-800',
      hover: 'hover:bg-indigo-800',
    },
    '10': {
      gradient: 'from-indigo-800 to-indigo-900',
      border: 'border-indigo-800',
      bg: 'bg-indigo-100',
      bgLight: 'bg-indigo-200',
      text: 'text-indigo-900',
      hover: 'hover:bg-indigo-900',
    },
  };

  return colorMap[courseId] || colorMap['1'];
};

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = courses.find((c) => c.slug === slug);

  if (!course) {
    notFound();
  }

  const color = getCourseColor(course.id);
  const courseNumber = String(course.id).padStart(2, '0');

  // Schema.org JSON-LD para SEO
  const courseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description,
    provider: {
      '@type': 'Organization',
      name: 'Prof. Daniel Barral',
      sameAs: 'https://profbarral.com.br',
    },
    educationalLevel: 'Professional',
    inLanguage: 'pt-BR',
    coursePrerequisites: 'Nenhum',
    teaches: course.title,
  };

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseSchema) }}
      />

      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Section com Cor do Curso */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${color.gradient}`}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMTRjMy4zMTQgMCA2IDIuNjg2IDYgNnMtMi42ODYgNi02IDYtNi0yLjY4Ni02LTYgMi42ODYtNiA2LTZ6TTI0IDM4YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>

        <div className="container mx-auto px-4 py-8 relative">
          <Link
            href="/cursos"
            className="inline-flex items-center gap-2 text-white hover:text-white/90 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Voltar para Cursos</span>
          </Link>

          <div className="max-w-6xl mx-auto">
            <div className="flex items-start gap-6 pb-12">
              {/* Número do Curso */}
              <div className="hidden md:block">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 text-center">
                  <div className="text-6xl font-bold text-white mb-2">{courseNumber}</div>
                  <div className="text-sm uppercase tracking-wider font-semibold text-white/90">Curso</div>
                </div>
              </div>

              {/* Título e Descrição */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="w-10 h-10 text-white" />
                  <span className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-bold text-white uppercase tracking-wide">
                    Curso Especializado
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                  {course.title}
                </h1>
                <p className="text-xl text-white/95 leading-relaxed max-w-3xl">
                  {course.shortDescription}
                </p>

                {/* Stats */}
                <div className="flex flex-wrap gap-4 mt-8">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold">Material Completo</span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold">Atualizado 2025</span>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 flex items-center gap-3">
                    <Award className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold">Certificado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Matrícula (apenas para alunos matriculados) */}
      <CourseEnrollmentInfo courseId={course.id} />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Coluna Principal */}
            <div className="lg:col-span-2 space-y-8">
              {/* Sobre o Curso */}
              <div className={`bg-white rounded-2xl shadow-lg p-8 border-2 ${color.border} hover:shadow-xl transition-shadow`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 bg-gradient-to-br ${color.gradient} rounded-xl flex items-center justify-center`}>
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">Sobre o Curso</h2>
                </div>
                <div className={`${color.bg} p-6 rounded-xl mb-6 border-l-4 ${color.border}`}>
                  <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed whitespace-pre-line">
                    {course.description}
                  </div>
                </div>

                {/* Diferenciais */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className={`${color.bg} p-4 rounded-xl`}>
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`w-6 h-6 ${color.text} flex-shrink-0 mt-1`} />
                      <div>
                        <h3 className="font-bold text-gray-900 mb-1">Conteúdo Atualizado</h3>
                        <p className="text-sm text-gray-700">Material constantemente revisado conforme nova legislação</p>
                      </div>
                    </div>
                  </div>
                  <div className={`${color.bg} p-4 rounded-xl`}>
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`w-6 h-6 ${color.text} flex-shrink-0 mt-1`} />
                      <div>
                        <h3 className="font-bold text-gray-900 mb-1">Abordagem Prática</h3>
                        <p className="text-sm text-gray-700">Casos reais e jurisprudência aplicada</p>
                      </div>
                    </div>
                  </div>
                  <div className={`${color.bg} p-4 rounded-xl`}>
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`w-6 h-6 ${color.text} flex-shrink-0 mt-1`} />
                      <div>
                        <h3 className="font-bold text-gray-900 mb-1">Material Exclusivo</h3>
                        <p className="text-sm text-gray-700">Acórdãos, pareceres e apostilas especializadas</p>
                      </div>
                    </div>
                  </div>
                  <div className={`${color.bg} p-4 rounded-xl`}>
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`w-6 h-6 ${color.text} flex-shrink-0 mt-1`} />
                      <div>
                        <h3 className="font-bold text-gray-900 mb-1">Especialista Renomado</h3>
                        <p className="text-sm text-gray-700">Prof. Daniel Barral, referência na área</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bibliografia Recomendada */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 bg-gradient-to-br ${color.gradient} rounded-xl flex items-center justify-center`}>
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-gray-900">Bibliografia Recomendada</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Material de referência disponível em PDF para alunos matriculados
                    </p>
                  </div>
                </div>

                <div className={`${color.bg} p-6 rounded-xl border-l-4 ${color.border}`}>
                  <div className="flex items-start gap-4">
                    <FileText className={`w-12 h-12 ${color.text} flex-shrink-0`} />
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg mb-2">
                        Bibliografia Completa em PDF
                      </h3>
                      <p className="text-gray-700 leading-relaxed mb-4">
                        O material bibliográfico completo deste curso está disponível em formato PDF
                        para download na área restrita dos alunos matriculados, incluindo:
                      </p>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${color.gradient}`}></div>
                          <span>Livros e doutrinas de referência</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${color.gradient}`}></div>
                          <span>Manuais e guias práticos</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${color.gradient}`}></div>
                          <span>Publicações técnicas especializadas</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${color.gradient}`}></div>
                          <span>Orientações normativas e legislação</span>
                        </li>
                      </ul>
                      <div className="mt-6 pt-4 border-t border-gray-300">
                        <Link
                          href="/login"
                          className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${color.gradient} text-white rounded-xl font-semibold hover:shadow-lg transition-all`}
                        >
                          <Lock className="w-4 h-4" />
                          Acessar Área Restrita
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Material de Apoio */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 bg-gradient-to-br ${color.gradient} rounded-xl flex items-center justify-center`}>
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">Material de Apoio Exclusivo</h2>
                </div>

                <div className="bg-gradient-to-r from-accent-50 to-accent-100 border-l-4 border-accent-500 p-6 mb-6 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-6 h-6 text-accent-600 flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-accent-900 font-semibold mb-2">Acesso Exclusivo para Alunos</p>
                      <p className="text-accent-800 text-sm leading-relaxed">
                        O material completo deste curso está disponível apenas para alunos matriculados
                        que receberam o QR Code de acesso durante o curso presencial.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-6 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900 text-lg">Apostila Completa</h3>
                      <Lock className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Material didático completo com teoria atualizada e casos práticos
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-6 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900 text-lg">Acórdãos do TCU</h3>
                      <Lock className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Jurisprudência selecionada, organizada e comentada
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-6 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900 text-lg">Pareceres da AGU</h3>
                      <Lock className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Orientações normativas e pareceres relevantes
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-6 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900 text-lg">Editais Comentados</h3>
                      <Lock className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Modelos práticos com análise detalhada
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Call to Action - Área Restrita */}
              <div className={`bg-gradient-to-br ${color.gradient} rounded-2xl shadow-xl p-8 text-white`}>
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-12 h-12 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Já é Aluno?</h3>
                  <p className="text-white/95 leading-relaxed mb-6">
                    Faça login para acessar todo o material exclusivo deste curso
                  </p>

                  {/* Botões de Acesso */}
                  <div className="space-y-3">
                    <Link
                      href={`/login?curso=${course.id}`}
                      className={`block bg-white ${color.text} px-8 py-4 rounded-xl font-bold hover:bg-white/90 transition-all shadow-lg hover:shadow-xl hover:scale-105 transform`}
                    >
                      Fazer Login
                    </Link>

                    <Link
                      href="/validar-acesso"
                      className="block bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/20 transition-all"
                    >
                      Usar QR Code
                    </Link>
                  </div>

                  <p className="text-xs text-white/75 mt-4">
                    Primeiro acesso? Use o QR Code do curso presencial
                  </p>
                </div>

                <div className="border-t border-white/20 pt-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-white/90">Acesso por 1 ano ao material</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-white/90">Atualizações constantes</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-white/90">Download de todo material</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Star className="w-5 h-5 text-accent-300 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-white/90 font-semibold">Opção de upgrade vitalício disponível</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card - Quer Participar? */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-200 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <Users className={`w-8 h-8 ${color.text}`} />
                  <h3 className="text-xl font-bold text-gray-900">Quer Participar?</h3>
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">
                  Entre em contato para saber sobre as próximas turmas abertas ou solicitar informações
                </p>
                <Link
                  href="/contato"
                  className={`block text-center bg-gradient-to-r ${color.gradient} text-white px-6 py-3 rounded-xl font-bold ${color.hover} transition-all shadow-md hover:shadow-lg`}
                >
                  Solicitar Informações
                </Link>
              </div>

              {/* Card - Cursos de Curta Duração */}
              <div className={`${color.bg} rounded-2xl p-6 border-2 ${color.border}`}>
                <div className="flex items-center gap-3 mb-4">
                  <Award className={`w-8 h-8 ${color.text}`} />
                  <h3 className="text-xl font-bold text-gray-900">Cursos de Curta Duração</h3>
                </div>
                <p className="text-gray-800 mb-4 leading-relaxed">
                  Podemos levar este curso para sua instituição com conteúdo personalizado e adaptado às necessidades específicas
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 ${color.text}`} />
                    <span className="text-gray-700">Conteúdo customizado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 ${color.text}`} />
                    <span className="text-gray-700">Agenda flexível</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-4 h-4 ${color.text}`} />
                    <span className="text-gray-700">Certificado digital</span>
                  </div>
                </div>
              </div>

              {/* Card Rápido - Outros Cursos */}
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-6 border-2 border-gray-300">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5 text-accent-600" />
                  Explore Outros Cursos
                </h3>
                <p className="text-sm text-gray-700 mb-4">
                  Temos 10 cursos especializados em Licitações e Contratos
                </p>
                <Link
                  href="/cursos"
                  className="block text-center bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
                >
                  Ver Todos os Cursos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
