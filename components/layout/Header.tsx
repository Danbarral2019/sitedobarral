'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, memo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, Home, User, FileText, Mail, LogIn, BookOpen, Scale, CreditCard, Gavel, BookMarked, Library, HelpCircle } from 'lucide-react';
import { courses } from '@/data/courses';

export const Header = memo(function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCoursesOpen, setIsCoursesOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const coursesDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Evita hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fecha dropdown quando clicar fora
  useEffect(() => {
    // Guard against SSR
    if (typeof window === 'undefined') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (coursesDropdownRef.current && !coursesDropdownRef.current.contains(event.target as Node)) {
        setIsCoursesOpen(false);
      }
    };

    if (isCoursesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isCoursesOpen]);

  return (
    <header className="bg-brand-600 shadow-lg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[10000] focus:bg-white focus:text-brand-700 focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:shadow-lg"
      >
        Pular para o conteúdo principal
      </a>
      <nav className="container mx-auto px-4">
        <div className="flex justify-between items-center h-20 sm:h-24">
          <Link href="/" className="flex items-center flex-shrink-0" aria-label="Página inicial - Prof. Daniel Barral">
            <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex-shrink-0">
              <Image
                src="/brand/logo-icon-96.png"
                alt="Logo Prof. Daniel Barral"
                width={96}
                height={96}
                className="object-contain w-full h-full"
                priority
              />
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
            <Link
              href="/"
              aria-current={isActive('/') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <Home className="w-4 h-4" />
              <span>Início</span>
            </Link>

            <Link
              href="/sobre"
              aria-current={isActive('/sobre') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/sobre') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <User className="w-4 h-4" />
              <span>Sobre</span>
            </Link>

            <div className="relative" ref={coursesDropdownRef} suppressHydrationWarning>
              <button
                onClick={() => setIsCoursesOpen(!isCoursesOpen)}
                aria-expanded={isCoursesOpen}
                aria-haspopup="true"
                className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/cursos') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Cursos</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isCoursesOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMounted && isCoursesOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-surface-page rounded-md py-2 max-h-96 overflow-y-auto z-[9999] border border-border-subtle shadow-xl">
                  <Link
                    href="/cursos"
                    className="block px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700"
                    onClick={() => setIsCoursesOpen(false)}
                  >
                    Ver todos os cursos
                  </Link>
                  <div className="border-t my-2"></div>
                  {courses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/cursos/${course.slug}`}
                      className="block px-4 py-2 text-sm text-ink-secondary hover:bg-brand-50 hover:text-brand-600"
                      onClick={() => setIsCoursesOpen(false)}
                    >
                      {course.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/base-conhecimento"
              aria-current={isActive('/base-conhecimento') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/base-conhecimento') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <Library className="w-4 h-4" />
              <span>Base de Conhecimento</span>
            </Link>

            <Link
              href="/legislacao"
              aria-current={isActive('/legislacao') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/legislacao') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <Scale className="w-4 h-4" />
              <span>Legislação</span>
            </Link>

            <Link
              href="/jurisprudencia"
              aria-current={isActive('/jurisprudencia') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/jurisprudencia') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <Gavel className="w-4 h-4" />
              <span>Jurisprudência</span>
            </Link>

            <Link
              href="/blog"
              aria-current={isActive('/blog') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/blog') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <FileText className="w-4 h-4" />
              <span>Blog</span>
            </Link>

            <Link
              href="/glossario"
              aria-current={isActive('/glossario') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/glossario') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <BookMarked className="w-4 h-4" />
              <span>Glossário</span>
            </Link>

            <Link
              href="/faq"
              aria-current={isActive('/faq') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/faq') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>FAQ</span>
            </Link>

            <Link
              href="/planos"
              aria-current={isActive('/planos') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/planos') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Planos</span>
            </Link>

            <Link
              href="/contato"
              aria-current={isActive('/contato') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/contato') ? 'text-surface-page font-semibold' : 'text-surface-page/90 hover:text-surface-page'}`}
            >
              <Mail className="w-4 h-4" />
              <span>Contato</span>
            </Link>

            <Link
              href="/login"
              className="flex items-center space-x-1 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-surface-page transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600"
            >
              <LogIn className="w-4 h-4" />
              <span>Área do Aluno</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 flex-shrink-0 text-surface-page"
            aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-brand-500 bg-brand-600">
            {[
              { href: '/', label: 'Início' },
              { href: '/sobre', label: 'Sobre o Professor' },
              { href: '/cursos', label: 'Cursos' },
              { href: '/base-conhecimento', label: 'Base de Conhecimento' },
              { href: '/legislacao', label: 'Legislação' },
              { href: '/jurisprudencia', label: 'Jurisprudência' },
              { href: '/blog', label: 'Blog' },
              { href: '/glossario', label: 'Glossário' },
              { href: '/faq', label: 'FAQ' },
              { href: '/planos', label: 'Planos' },
              { href: '/contato', label: 'Contato' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={`block py-3 px-2 rounded transition-colors font-poppins ${isActive(href) ? 'text-surface-page font-semibold bg-brand-500' : 'text-surface-page/90 hover:text-surface-page hover:bg-brand-500'}`}
                onClick={() => setIsMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="mt-4 pt-4 border-t border-brand-500">
              <Link
                href="/login"
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-surface-page transition-colors font-poppins"
                onClick={() => setIsMenuOpen(false)}
              >
                <LogIn className="w-4 h-4" />
                <span>Área do Aluno</span>
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
});