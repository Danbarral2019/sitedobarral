import Link from 'next/link';
import { ArrowRight, BookOpen, Clock, Users, FileText } from 'lucide-react';
import { courses } from '@/data/courses';

export default function CursosPage() {
  return (
    <main className="py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block">
              <h1 className="text-5xl font-bold mb-3 text-gray-900">Cursos Especializados</h1>
              <div className="h-1.5 w-40 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full mx-auto mb-6"></div>
            </div>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Explore nossa biblioteca completa de cursos em Direito Administrativo,
              com foco em Licitações e Contratos Administrativos
            </p>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-gray-50 border-l-4 border-blue-600 p-8 mb-12 rounded-2xl shadow-md">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-3 text-blue-900">Como acessar o material exclusivo?</h2>
                <p className="text-blue-900 text-lg leading-relaxed">
                  Ao participar de nossos cursos presenciais abertos ou in company,
                  você receberá um QR Code exclusivo para acessar todo o material complementar
                  do curso, incluindo apostilas, acórdãos do TCU, pareceres da AGU e muito mais.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-8">
            {courses.map((course, index) => {
              const colors = [
                { gradient: 'from-blue-300 to-blue-400', border: 'border-blue-300', bg: 'bg-blue-50' },     // Curso 01 - Azul muito claro
                { gradient: 'from-blue-400 to-blue-500', border: 'border-blue-400', bg: 'bg-blue-50' },     // Curso 02 - Azul claro
                { gradient: 'from-blue-500 to-blue-600', border: 'border-blue-500', bg: 'bg-blue-50' },     // Curso 03 - Azul claro-médio
                { gradient: 'from-blue-600 to-blue-700', border: 'border-blue-600', bg: 'bg-blue-100' },    // Curso 04 - Azul médio
                { gradient: 'from-blue-700 to-blue-800', border: 'border-blue-700', bg: 'bg-blue-100' },    // Curso 05 - Azul médio-escuro
                { gradient: 'from-blue-800 to-blue-900', border: 'border-blue-800', bg: 'bg-blue-100' },    // Curso 06 - Azul escuro
                { gradient: 'from-sky-600 to-sky-700', border: 'border-sky-600', bg: 'bg-sky-50' },         // Curso 07 - Sky médio
                { gradient: 'from-sky-700 to-sky-800', border: 'border-sky-700', bg: 'bg-sky-100' },        // Curso 08 - Sky escuro
                { gradient: 'from-indigo-700 to-indigo-800', border: 'border-indigo-700', bg: 'bg-indigo-50' }, // Curso 09 - Indigo escuro
                { gradient: 'from-indigo-800 to-indigo-900', border: 'border-indigo-800', bg: 'bg-indigo-100' }, // Curso 10 - Indigo muito escuro
              ];
              const color = colors[index % colors.length];

              return (
                <div key={course.id} className={`bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all border-2 ${color.border} hover:scale-[1.01]`}>
                  <div className="md:flex">
                    <div className={`md:w-1/4 bg-gradient-to-br ${color.gradient} p-8 flex items-center justify-center`}>
                      <div className="text-center text-white">
                        <div className="text-6xl font-bold mb-2">{String(index + 1).padStart(2, '0')}</div>
                        <div className="text-sm uppercase tracking-wider font-semibold">Curso</div>
                      </div>
                    </div>
                    <div className="md:w-3/4 p-8">
                      <h2 className="text-2xl font-bold mb-3 text-gray-900">
                        {course.title}
                      </h2>
                      <p className="text-gray-700 mb-6 text-lg leading-relaxed">
                        {course.shortDescription}
                      </p>

                      <div className={`${color.bg} p-4 rounded-xl mb-6 border-l-4 ${color.border}`}>
                        <h3 className="font-bold mb-2 text-gray-900">Conteúdo do Curso:</h3>
                        <p className="text-gray-800 line-clamp-3 leading-relaxed">
                          {course.description}
                        </p>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4 mb-6">
                        <div className={`flex items-center gap-2 text-sm font-medium ${color.bg} px-3 py-2 rounded-lg`}>
                          <FileText className="w-5 h-5 text-blue-600" />
                          <span className="text-gray-900">{course.bibliography.length} Referências</span>
                        </div>
                        <div className={`flex items-center gap-2 text-sm font-medium ${color.bg} px-3 py-2 rounded-lg`}>
                          <Clock className="w-5 h-5 text-blue-600" />
                          <span className="text-gray-900">Material Atualizado</span>
                        </div>
                        <div className={`flex items-center gap-2 text-sm font-medium ${color.bg} px-3 py-2 rounded-lg`}>
                          <Users className="w-5 h-5 text-gray-600" />
                          <span className="text-gray-900">Acesso Exclusivo</span>
                        </div>
                      </div>

                      <Link
                        href={`/cursos/${course.slug}`}
                        className={`inline-flex items-center gap-2 bg-gradient-to-r ${color.gradient} text-white px-8 py-4 rounded-xl font-bold hover:shadow-lg transition-all transform hover:-translate-y-0.5`}
                      >
                        <BookOpen className="w-5 h-5" />
                        Ver Detalhes do Curso
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 opacity-95"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0yNCAzOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
            <div className="relative p-10 md:p-12 text-center rounded-2xl">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                Interessado em nossos cursos?
              </h2>
              <p className="text-white text-xl mb-8 max-w-2xl mx-auto leading-relaxed opacity-95">
                Entre em contato para saber sobre as próximas turmas ou
                solicitar um curso in company para sua instituição.
              </p>
              <Link
                href="/contato"
                className="inline-flex items-center gap-3 bg-white text-gray-900 px-12 py-5 rounded-xl text-xl font-bold hover:bg-gray-50 transition-all hover:scale-105 shadow-2xl"
                aria-label="Entre em contato conosco para saber mais sobre os cursos"
              >
                Fale Conosco
                <ArrowRight className="w-6 h-6" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}