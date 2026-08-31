import Link from 'next/link';
import { Home, Search, BookOpen, Scale, FileText } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <span className="text-8xl font-bold text-brand-200 font-cinzel">404</span>
        </div>

        <h1 className="text-3xl font-bold text-ink-primary mb-4 font-cinzel">
          Página não encontrada
        </h1>

        <p className="text-lg text-ink-muted mb-8 leading-relaxed">
          A página que você procura não existe ou foi movida.
          Confira os links abaixo para encontrar o que precisa.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Link
            href="/"
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-[6px] border-2 border-border-subtle hover:border-brand-400 hover:bg-brand-50 transition-all group"
          >
            <Home className="w-6 h-6 text-ink-muted group-hover:text-brand-600" />
            <span className="text-sm font-semibold text-ink-secondary group-hover:text-brand-700">Início</span>
          </Link>

          <Link
            href="/cursos"
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-[6px] border-2 border-border-subtle hover:border-brand-400 hover:bg-brand-50 transition-all group"
          >
            <BookOpen className="w-6 h-6 text-ink-muted group-hover:text-brand-600" />
            <span className="text-sm font-semibold text-ink-secondary group-hover:text-brand-700">Cursos</span>
          </Link>

          <Link
            href="/artigos"
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-[6px] border-2 border-border-subtle hover:border-brand-400 hover:bg-brand-50 transition-all group"
          >
            <Scale className="w-6 h-6 text-ink-muted group-hover:text-brand-600" />
            <span className="text-sm font-semibold text-ink-secondary group-hover:text-brand-700">Lei 14.133</span>
          </Link>

          <Link
            href="/blog"
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-[6px] border-2 border-border-subtle hover:border-brand-400 hover:bg-brand-50 transition-all group"
          >
            <FileText className="w-6 h-6 text-ink-muted group-hover:text-brand-600" />
            <span className="text-sm font-semibold text-ink-secondary group-hover:text-brand-700">Blog</span>
          </Link>
        </div>

        <div className="bg-brand-50 rounded-[6px] p-6 border-2 border-brand-200">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Search className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-brand-900">Procurando algo específico?</h2>
          </div>
          <p className="text-sm text-brand-700 mb-4">
            Use a busca na área restrita ou navegue pelos artigos da Lei 14.133/2021.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/busca"
              className="inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-[6px] font-bold hover:bg-brand-700 transition-colors"
            >
              <Search className="w-4 h-4" />
              Buscar no Site
            </Link>
            <Link
              href="/contato"
              className="inline-flex items-center justify-center gap-2 bg-white text-brand-700 px-6 py-3 rounded-[6px] font-bold border-2 border-brand-300 hover:bg-brand-50 transition-colors"
            >
              Fale Conosco
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
