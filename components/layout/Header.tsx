'use client';

import Link from 'next/link';
import { useState, memo, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown, BookOpen, User, FileText, Mail, Home, LogIn, Award, Library, HelpCircle, Gavel, Scale } from 'lucide-react';
import { courses } from '@/data/courses';

export const Header = memo(function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCoursesOpen, setIsCoursesOpen] = useState(false);
  const coursesDropdownRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown quando clicar fora
  useEffect(() => {
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
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">Prof. Daniel Barral</h1>
              <p className="text-xs text-gray-600 hidden sm:block">Especialista em Licitações e Contratos</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/" 
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Início</span>
            </Link>

            <Link 
              href="/sobre" 
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Sobre</span>
            </Link>

            <div className="relative" ref={coursesDropdownRef}>
              <button
                onClick={() => setIsCoursesOpen(!isCoursesOpen)}
                className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>Cursos</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isCoursesOpen ? 'rotate-180' : ''}`} />
              </button>

              {isCoursesOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl py-2 max-h-96 overflow-y-auto z-[9999] border border-gray-200">
                  <Link
                    href="/cursos"
                    className="block px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-primary-50 hover:text-primary-600"
                    onClick={() => setIsCoursesOpen(false)}
                  >
                    Ver todos os cursos
                  </Link>
                  <div className="border-t my-2"></div>
                  {courses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/cursos/${course.slug}`}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600"
                      onClick={() => setIsCoursesOpen(false)}
                    >
                      {course.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/artigos"
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <Gavel className="w-4 h-4" />
              <span>Lei 14.133</span>
            </Link>

            <Link
              href="/legislacao"
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <Scale className="w-4 h-4" />
              <span>Atos Normativos</span>
            </Link>

            <Link
              href="/blog"
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Blog</span>
            </Link>

            <Link
              href="/publicacoes"
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <Award className="w-4 h-4" />
              <span>Publicações</span>
            </Link>

            <Link
              href="/glossario"
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <Library className="w-4 h-4" />
              <span>Glossário</span>
            </Link>

            <Link
              href="/faq"
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>FAQ</span>
            </Link>

            <Link
              href="/contato"
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>Contato</span>
            </Link>

            <Link
              href="/login"
              className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Área do Aluno</span>
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 flex-shrink-0"
          >
            {isMenuOpen ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <Link
              href="/"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Início
            </Link>
            <Link
              href="/sobre"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Sobre o Professor
            </Link>
            <Link
              href="/cursos"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Cursos
            </Link>
            <Link
              href="/artigos"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Lei 14.133/2021
            </Link>
            <Link
              href="/legislacao"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Atos Normativos
            </Link>
            <Link
              href="/blog"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Blog
            </Link>
            <Link
              href="/publicacoes"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Publicações
            </Link>
            <Link
              href="/glossario"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Glossário
            </Link>
            <Link
              href="/faq"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              FAQ
            </Link>
            <Link
              href="/contato"
              className="block py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Contato
            </Link>
            <Link
              href="/login"
              className="flex items-center space-x-2 py-2 text-gray-700 hover:text-primary-600"
              onClick={() => setIsMenuOpen(false)}
            >
              <LogIn className="w-4 h-4" />
              <span>Área do Aluno</span>
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
});