'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, memo, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown, User, FileText, Mail, Home, LogIn, Award, BookOpen } from 'lucide-react';
import { courses } from '@/data/courses';

export const Header = memo(function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCoursesOpen, setIsCoursesOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const coursesDropdownRef = useRef<HTMLDivElement>(null);

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
              className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded"
            >
              <Home className="w-4 h-4" />
              <span>Início</span>
            </Link>

            <Link
              href="/sobre"
              className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded"
            >
              <User className="w-4 h-4" />
              <span>Sobre</span>
            </Link>

            <div className="relative" ref={coursesDropdownRef} suppressHydrationWarning>
              <button
                onClick={() => setIsCoursesOpen(!isCoursesOpen)}
                aria-expanded={isCoursesOpen}
                aria-haspopup="true"
                className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded"
              >
                <BookOpen className="w-4 h-4" />
                <span>Cursos</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isCoursesOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMounted && isCoursesOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl py-2 max-h-96 overflow-y-auto z-[9999] border border-gray-200">
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
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-600"
                      onClick={() => setIsCoursesOpen(false)}
                    >
                      {course.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/blog"
              className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded"
            >
              <FileText className="w-4 h-4" />
              <span>Blog</span>
            </Link>

            <Link
              href="/publicacoes"
              className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded"
            >
              <Award className="w-4 h-4" />
              <span>Publicações</span>
            </Link>

            <Link
              href="/contato"
              className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors font-poppins text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600 rounded"
            >
              <Mail className="w-4 h-4" />
              <span>Contato</span>
            </Link>

            <Link
              href="/validar-acesso"
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
            <Link
              href="/"
              className="block py-3 px-2 text-white/90 hover:text-white hover:bg-brand-500 rounded transition-colors font-poppins"
              onClick={() => setIsMenuOpen(false)}
            >
              Início
            </Link>
            <Link
              href="/sobre"
              className="block py-3 px-2 text-white/90 hover:text-white hover:bg-brand-500 rounded transition-colors font-poppins"
              onClick={() => setIsMenuOpen(false)}
            >
              Sobre o Professor
            </Link>
            <Link
              href="/cursos"
              className="block py-3 px-2 text-white/90 hover:text-white hover:bg-brand-500 rounded transition-colors font-poppins"
              onClick={() => setIsMenuOpen(false)}
            >
              Cursos
            </Link>
            <Link
              href="/blog"
              className="block py-3 px-2 text-white/90 hover:text-white hover:bg-brand-500 rounded transition-colors font-poppins"
              onClick={() => setIsMenuOpen(false)}
            >
              Blog
            </Link>
            <Link
              href="/publicacoes"
              className="block py-3 px-2 text-white/90 hover:text-white hover:bg-brand-500 rounded transition-colors font-poppins"
              onClick={() => setIsMenuOpen(false)}
            >
              Publicações
            </Link>
            <Link
              href="/contato"
              className="block py-3 px-2 text-white/90 hover:text-white hover:bg-brand-500 rounded transition-colors font-poppins"
              onClick={() => setIsMenuOpen(false)}
            >
              Contato
            </Link>
            <div className="mt-4 pt-4 border-t border-brand-500">
              <Link
                href="/validar-acesso"
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors font-poppins"
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