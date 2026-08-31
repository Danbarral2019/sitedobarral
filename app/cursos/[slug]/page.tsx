import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, Lock, CheckCircle,
  Award, Target, PlayCircle, Layers
} from 'lucide-react';
import { courses } from '@/data/courses';
import { prisma } from '@/lib/prisma';
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

// Mapeamento de cores por ID do curso - Paleta brand (azul petroleo)
// Todos os cursos usam a paleta brand para manter consistência visual
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
      gradient: 'from-brand-500 to-brand-600',
      border: 'border-brand-300',
      bg: 'bg-brand-50',
      bgLight: 'bg-brand-100',
      text: 'text-brand-600',
      hover: 'hover:bg-brand-600',
    },
    '2': {
      gradient: 'from-brand-600 to-brand-700',
      border: 'border-brand-400',
      bg: 'bg-brand-50',
      bgLight: 'bg-brand-100',
      text: 'text-brand-700',
      hover: 'hover:bg-brand-700',
    },
    '3': {
      gradient: 'from-brand-600 to-brand-700',
      border: 'border-brand-500',
      bg: 'bg-brand-50',
      bgLight: 'bg-brand-100',
      text: 'text-brand-700',
      hover: 'hover:bg-brand-700',
    },
    '4': {
      gradient: 'from-brand-600 to-brand-700',
      border: 'border-brand-600',
      bg: 'bg-brand-100',
      bgLight: 'bg-brand-200',
      text: 'text-brand-800',
      hover: 'hover:bg-brand-700',
    },
    '5': {
      gradient: 'from-brand-700 to-brand-800',
      border: 'border-brand-700',
      bg: 'bg-brand-100',
      bgLight: 'bg-brand-200',
      text: 'text-brand-800',
      hover: 'hover:bg-brand-800',
    },
    '6': {
      gradient: 'from-brand-800 to-brand-900',
      border: 'border-brand-800',
      bg: 'bg-brand-100',
      bgLight: 'bg-brand-200',
      text: 'text-brand-900',
      hover: 'hover:bg-brand-900',
    },
    '7': {
      gradient: 'from-brand-500 to-brand-600',
      border: 'border-brand-500',
      bg: 'bg-brand-50',
      bgLight: 'bg-brand-100',
      text: 'text-brand-700',
      hover: 'hover:bg-brand-600',
    },
    '8': {
      gradient: 'from-brand-600 to-brand-700',
      border: 'border-brand-600',
      bg: 'bg-brand-100',
      bgLight: 'bg-brand-200',
      text: 'text-brand-800',
      hover: 'hover:bg-brand-700',
    },
    '9': {
      gradient: 'from-brand-700 to-brand-800',
      border: 'border-brand-700',
      bg: 'bg-brand-50',
      bgLight: 'bg-brand-100',
      text: 'text-brand-800',
      hover: 'hover:bg-brand-800',
    },
    '10': {
      gradient: 'from-brand-800 to-brand-900',
      border: 'border-brand-800',
      bg: 'bg-brand-100',
      bgLight: 'bg-brand-200',
      text: 'text-brand-900',
      hover: 'hover:bg-brand-900',
    },
  };

  return colorMap[courseId] || colorMap['2'];
};

export const revalidate = 3600; // ISR: revalida a cada 1h

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = courses.find((c) => c.slug === slug);

  if (!course) {
    notFound();
  }

  const color = getCourseColor(course.id);
  const courseNumber = String(course.id).padStart(2, '0');

  // Fetch published modules with lesson count for preview
  // Wrapped in try/catch for environments without DB (CI build)
  let modules: { id: string; title: string; displayOrder: number; _count: { lessons: number } }[] = [];
  try {
    modules = await prisma.module.findMany({
      where: { courseId: course.id, isPublished: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        title: true,
        displayOrder: true,
        _count: {
          select: {
            lessons: {
              where: { isPublished: true },
            },
          },
        },
      },
    });
  } catch {
    // DB unavailable (e.g. CI build) — render without modules
  }

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

      <main className="min-h-screen bg-white">
      {/* Hero Section com Cor do Curso */}
      <div className={`relative overflow-hidden ${color.gradient}`}>
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
                <div className="bg-white/20 rounded-[6px] p-6 text-center">
                  <div className="text-6xl font-bold text-white mb-2">{courseNumber}</div>
                  <div className="text-sm uppercase tracking-wider font-semibold text-white/90">Curso</div>
                </div>
              </div>

              {/* Título e Descrição */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="w-10 h-10 text-white" />
                  <span className="bg-white/20 px-4 py-1.5 rounded-full text-sm font-bold text-white uppercase tracking-wide">
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
                  {modules.length > 0 && (
                    <div className="bg-white/20 rounded-[6px] px-6 py-3 flex items-center gap-3">
                      <Layers className="w-5 h-5 text-white" />
                      <span className="text-white font-semibold">
                        {modules.length} {modules.length === 1 ? 'Módulo' : 'Módulos'} · {modules.reduce((s, m) => s + m._count.lessons, 0)} Aulas
                      </span>
                    </div>
                  )}
                  <div className="bg-white/20 rounded-[6px] px-6 py-3 flex items-center gap-3">
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
              <div className={`bg-white rounded-[6px] p-8 border-2 ${color.border} hover: transition-shadow`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 ${color.gradient} rounded-[6px] flex items-center justify-center`}>
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-ink-primary">Sobre o Curso</h2>
                </div>
                <div className={`${color.bg} p-6 rounded-[6px] mb-6 border-l-4 ${color.border}`}>
                  <div className="prose prose-lg max-w-none text-ink-secondary leading-relaxed whitespace-pre-line">
                    {course.description}
                  </div>
                </div>

                {/* Diferenciais */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className={`${color.bg} p-4 rounded-[6px]`}>
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`w-6 h-6 ${color.text} flex-shrink-0 mt-1`} />
                      <div>
                        <h3 className="font-bold text-ink-primary mb-1">Conteúdo Atualizado</h3>
                        <p className="text-sm text-ink-secondary">Material revisado conforme nova legislação</p>
                      </div>
                    </div>
                  </div>
                  <div className={`${color.bg} p-4 rounded-[6px]`}>
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`w-6 h-6 ${color.text} flex-shrink-0 mt-1`} />
                      <div>
                        <h3 className="font-bold text-ink-primary mb-1">Abordagem Prática</h3>
                        <p className="text-sm text-ink-secondary">Casos reais e jurisprudência aplicada</p>
                      </div>
                    </div>
                  </div>
                  <div className={`${color.bg} p-4 rounded-[6px]`}>
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`w-6 h-6 ${color.text} flex-shrink-0 mt-1`} />
                      <div>
                        <h3 className="font-bold text-ink-primary mb-1">Material Exclusivo</h3>
                        <p className="text-sm text-ink-secondary">Acórdãos, pareceres e apostilas especializadas</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conteúdo Programático (Preview de Módulos) */}
              {modules.length > 0 && (
                <div className={`bg-white rounded-[6px] p-8 border-2 ${color.border} hover: transition-shadow`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-12 h-12 ${color.gradient} rounded-[6px] flex items-center justify-center`}>
                      <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-ink-primary">Conteudo Programatico</h2>
                      <p className="text-sm text-ink-muted mt-1">
                        {modules.length} {modules.length === 1 ? 'modulo' : 'modulos'} com{' '}
                        {modules.reduce((sum, m) => sum + m._count.lessons, 0)} aulas estruturadas
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {modules.map((mod, index) => (
                      <div
                        key={mod.id}
                        className={`${color.bg} rounded-[6px] p-4 flex items-center gap-4 border border-white`}
                      >
                        <div className={`w-10 h-10 ${color.gradient} rounded-[6px] flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-bold text-sm">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-ink-primary truncate">{mod.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <PlayCircle className={`w-3.5 h-3.5 ${color.text}`} />
                            <span className="text-xs text-ink-muted">
                              {mod._count.lessons} {mod._count.lessons === 1 ? 'aula' : 'aulas'}
                            </span>
                          </div>
                        </div>
                        <Lock className="w-4 h-4 text-ink-muted flex-shrink-0" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-border-subtle">
                    <div className="flex items-center gap-2 text-sm text-ink-muted">
                      <Lock className="w-4 h-4" />
                      <span>Conteudo completo disponivel para alunos matriculados</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className={`${color.gradient} rounded-[6px] p-8 text-white sticky top-8`}>
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-3">Já é Aluno?</h3>
                  <p className="text-white/90 leading-relaxed mb-6 text-sm">
                    Faça login para acessar o material exclusivo deste curso na área restrita.
                  </p>

                  <Link
                    href={`/login?curso=${course.id}`}
                    className={`block bg-white ${color.text} px-8 py-4 rounded-[6px] font-bold hover:bg-white/90 transition-all`}
                  >
                    Fazer Login
                  </Link>

                  <p className="text-xs text-white/80 mt-4">
                    Primeiro acesso?{' '}
                    <Link href="/validar-acesso" className="underline hover:text-white">
                      Use o QR Code do curso
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Link discreto pra catálogo */}
          <div className="mt-16 text-center">
            <Link
              href="/cursos"
              className="inline-flex items-center gap-2 text-ink-muted hover:text-brand-700 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Ver todos os cursos
            </Link>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
