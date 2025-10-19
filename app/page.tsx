import Link from 'next/link';
import { ArrowRight, BookOpen, Users, Award, FileText, CheckCircle, Star } from 'lucide-react';
import { courses } from '@/data/courses';
import TestimonialsCarousel from '@/components/TestimonialsCarousel';

export default function Home() {
  const featuredCourses = courses.slice(0, 3);

  return (
    <main>
      <section className="text-white py-20" style={{background: 'linear-gradient(to bottom, #1e293b 0%, #334155 100%)'}}>
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Prof. Daniel Barral
            </h1>
            <p className="text-xl md:text-2xl mb-4">
              Professor | Mestre em Direito Público
            </p>
            <p className="text-lg mb-8 text-blue-100">
              Especialista em Licitações e Contratos Administrativos
            </p>
            <p className="text-lg mb-10 max-w-2xl mx-auto text-gray-100">
              Repositório especializado de materiais jurídicos em Direito Administrativo,
              com foco em fortalecer seu conhecimento e aprimorar suas atividades funcionais.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/cursos"
                className="bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors inline-flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                Explorar Cursos
              </Link>
              <Link
                href="/validar-acesso"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2 border border-blue-500"
              >
                Área do Aluno
                <ArrowRight className="w-5 h-5 text-white" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                  <Award className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-blue-500 rounded-full"></div>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Experiência Comprovada</h3>
              <p className="text-gray-700 leading-relaxed">
                Anos de atuação como professor especializado em Direito Administrativo
              </p>
            </div>
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-24 h-24 bg-white border-4 border-blue-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-12 h-12 text-blue-600" />
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-blue-500 rounded-full"></div>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Conteúdo Atualizado</h3>
              <p className="text-gray-700 leading-relaxed">
                Material sempre atualizado com as últimas mudanças legislativas e jurisprudenciais
              </p>
            </div>
            <div className="text-center group">
              <div className="relative mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                  <FileText className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gray-600 rounded-full"></div>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Material Exclusivo</h3>
              <p className="text-gray-700 leading-relaxed">
                Acesso a documentos e acórdãos organizados por tema
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-block">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Cursos em Destaque</h2>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full mx-auto"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredCourses.map((course, index) => (
              <div key={course.id} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-500 hover:shadow-2xl transition-all duration-300 group">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                      Curso {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-blue-600 transition-colors">{course.title}</h3>
                  <p className="text-gray-700 mb-6 leading-relaxed">{course.shortDescription}</p>
                  <Link
                    href={`/cursos/${course.slug}`}
                    className="text-blue-600 font-bold hover:text-blue-700 inline-flex items-center gap-2 group-hover:gap-3 transition-all"
                  >
                    Saiba mais
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/cursos"
              className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold hover:bg-blue-700 transition-all inline-flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Ver todos os cursos
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Como Funciona</h2>
              <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full mx-auto"></div>
            </div>
            <div className="space-y-8">
              <div className="flex gap-6 items-start bg-white p-6 rounded-2xl border-l-4 border-blue-500 shadow-md hover:shadow-xl transition-shadow">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-2xl shadow-lg">
                    1
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">Explore os Cursos</h3>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Navegue pela nossa biblioteca de cursos especializados em Direito Administrativo
                  </p>
                </div>
              </div>
              <div className="flex gap-6 items-start bg-white p-6 rounded-2xl border-l-4 border-blue-600 shadow-md hover:shadow-xl transition-shadow">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-white border-4 border-blue-500 text-blue-600 rounded-xl flex items-center justify-center font-bold text-2xl shadow-lg">
                    2
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">Participe dos Cursos Presenciais</h3>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Inscreva-se nos cursos presenciais abertos ou in company
                  </p>
                </div>
              </div>
              <div className="flex gap-6 items-start bg-white p-6 rounded-2xl border-l-4 border-gray-600 shadow-md hover:shadow-xl transition-shadow">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-gray-600 text-white rounded-xl flex items-center justify-center font-bold text-2xl shadow-lg">
                    3
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">Acesse Material Exclusivo</h3>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Receba QR Code exclusivo para acessar todo o material complementar do curso
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Depoimentos de Alunos</h2>
              <div className="h-1 w-24 bg-gradient-to-r from-accent-400 to-accent-500 rounded-full mx-auto"></div>
            </div>

            {/* Carrossel de Depoimentos */}
            <TestimonialsCarousel />

            {/* Botão para Enviar Depoimento */}
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

      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 rounded-2xl p-10 md:p-12 text-center shadow-2xl border-4 border-blue-700">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE0YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0yNCAzOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"></div>

              <div className="relative z-10">
                <div className="inline-block mb-4">
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white font-semibold text-sm">📧 Newsletter Jurídica</span>
                  </div>
                </div>

                <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                  Mantenha-se Atualizado
                </h2>
                <p className="text-xl text-white mb-10 max-w-2xl mx-auto leading-relaxed">
                  Cadastre-se em nossa newsletter e receba novidades sobre legislação,
                  jurisprudência e novos materiais disponíveis.
                </p>

                <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto bg-white/10 backdrop-blur-md p-2 rounded-2xl border-2 border-white/30">
                  <input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    aria-label="Digite seu e-mail para receber atualizações"
                    required
                    className="flex-1 px-6 py-4 rounded-xl bg-white text-gray-900 placeholder:text-gray-500 font-medium text-lg focus:outline-none focus:ring-4 focus:ring-white/50"
                  />
                  <button
                    type="submit"
                    aria-label="Cadastrar na newsletter"
                    className="bg-accent-400 text-gray-900 px-10 py-4 rounded-xl text-lg font-bold hover:bg-accent-500 transition-all hover:scale-105 shadow-xl whitespace-nowrap"
                  >
                    Cadastrar Agora
                  </button>
                </form>

                <p className="text-white/80 text-sm mt-4">
                  ✓ Sem spam · ✓ Cancele quando quiser · ✓ Conteúdo exclusivo
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Botão Admin - Discreto */}
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