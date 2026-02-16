'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, memo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, User, FileText, Mail, Home, LogIn, BookOpen, Scale, CreditCard } from 'lucide-react';
import { courses } from '@/data/courses';
import { ThemeToggle } from '@/components/ThemeToggle';

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
        <div className="flex justify-between items-center h-28">
          <Link href="/" className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0 group">
            <div className="w-16 h-16 sm:w-24 sm:h-24 relative flex-shrink-0">
              <Image
                src="/brand/logo-icon.png"
                alt="Logo Prof. Daniel Barral"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-cinzel font-semibold text-white tracking-wide truncate group-hover:text-brand-100 transition-colors">
                Daniel Barral
              </h1>
              <p className="text-xs text-brand-200 hidden sm:block font-poppins">
                Professor de Licitações e Contratos
              </p>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <Link
              href="/"
              aria-current={isActive('/') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/') ? 'text-white font-semibold' : 'text-white/90 hover:text-white'}`}
            >
              <Home className="w-4 h-4" />
              <span>Início</span>
            </Link>

            <Link
              href="/sobre"
              aria-current={isActive('/sobre') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/sobre') ? 'text-white font-semibold' : 'text-white/90 hover:text-white'}`}
            >
              <User className="w-4 h-4" />
              <span>Sobre</span>
            </Link>

            <div className="relative" ref={coursesDropdownRef} suppressHydrationWarning>
              <button
                onClick={() => setIsCoursesOpen(!isCoursesOpen)}
                aria-expanded={isCoursesOpen}
                aria-haspopup="true"
                className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/cursos') ? 'text-white font-semibold' : 'text-white/90 hover:text-white'}`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Cursos</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isCoursesOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMounted && isCoursesOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-[var(--bg-card)] rounded-lg shadow-xl py-2 max-h-96 overflow-y-auto z-[9999] border border-[var(--border-default)]">
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
                      className="block px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-brand-50 hover:text-brand-600"
                      onClick={() => setIsCoursesOpen(false)}
                    >
                      {course.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/legislacao"
              aria-current={isActive('/legislacao') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/legislacao') ? 'text-white font-semibold' : 'text-white/90 hover:text-white'}`}
            >
              <Scale className="w-4 h-4" />
              <span>Legislação</span>
            </Link>

            <Link
              href="/blog"
              aria-current={isActive('/blog') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/blog') ? 'text-white font-semibold' : 'text-white/90 hover:text-white'}`}
            >
              <FileText className="w-4 h-4" />
              <span>Blog</span>
            </Link>

            <Link
              href="/planos"
              aria-current={isActive('/planos') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/planos') ? 'text-white font-semibold' : 'text-white/90 hover:text-white'}`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Planos</span>
            </Link>

            <Link
              href="/contato"
              aria-current={isActive('/contato') ? 'page' : undefined}
              className={`flex items-center space-x-1 transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded ${isActive('/contato') ? 'text-white font-semibold' : 'text-white/90 hover:text-white'}`}
            >
              <Mail className="w-4 h-4" />
              <span>Contato</span>
            </Link>

            <ThemeToggle />

            <Link
              href="/login"
              className="flex items-center space-x-1 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-white transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600"
            >
              <LogIn className="w-4 h-4" />
              <span>Área do Aluno</span>
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 flex-shrink-0 text-white"
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
              { href: '/legislacao', label: 'Legislação' },
              { href: '/blog', label: 'Blog' },
              { href: '/planos', label: 'Planos' },
              { href: '/contato', label: 'Contato' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={`block py-3 px-2 rounded transition-colors font-poppins ${isActive(href) ? 'text-white font-semibold bg-brand-500' : 'text-white/90 hover:text-white hover:bg-brand-500'}`}
                onClick={() => setIsMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="mt-4 pt-4 border-t border-brand-500 space-y-3">
              <Link
                href="/login"
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors font-poppins"
                onClick={() => setIsMenuOpen(false)}
              >
                <LogIn className="w-4 h-4" />
                <span>Área do Aluno</span>
              </Link>
              <div className="flex justify-center">
                <ThemeToggle />
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
});