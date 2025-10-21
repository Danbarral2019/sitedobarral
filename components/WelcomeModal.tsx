'use client';

import { useEffect, useState } from 'react';
import { X, BookOpen, Users, Award, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const STORAGE_KEY = 'profbarral_visited';

/**
 * Modal de Boas-Vindas exibido na primeira visita
 *
 * Características:
 * - Detecta primeira visita via localStorage
 * - Pode ser fechado manualmente
 * - Não aparece em rotas admin ou área restrita
 * - Design responsivo e acessível
 */
export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Verificar se deve mostrar o modal
    const hasVisited = localStorage.getItem(STORAGE_KEY);
    const isAdminRoute = window.location.pathname.startsWith('/admin');
    const isRestrictedRoute = window.location.pathname.startsWith('/area-restrita');

    if (!hasVisited && !isAdminRoute && !isRestrictedRoute) {
      // Delay para melhor experiência
      setTimeout(() => {
        setIsOpen(true);
        setShouldShow(true);
      }, 1500);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleExplore = () => {
    handleClose();
  };

  if (!shouldShow) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
          onClick={handleClose}
        />
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none overflow-y-auto">
          <div
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full pointer-events-auto transform transition-all duration-300 scale-100 opacity-100 my-auto max-h-[95vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 p-5 sm:p-8 rounded-t-xl sm:rounded-t-2xl">
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
                aria-label="Fechar modal"
              >
                <X className="w-7 h-7 sm:w-6 sm:h-6" />
              </button>

              <div className="text-center pr-8 sm:pr-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <h2 id="welcome-title" className="text-xl sm:text-3xl font-bold text-white mb-2 leading-tight">
                  Bem-vindo ao Site do Prof. Daniel Barral
                </h2>
                <p className="hidden sm:block text-blue-100 text-sm sm:text-lg">
                  Especialista em Licitações e Contratos Administrativos
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 sm:p-8">
              <p className="text-gray-700 text-base sm:text-lg mb-5 sm:mb-6 text-center leading-relaxed">
                Repositório especializado de materiais jurídicos em Direito Administrativo,
                organizados por tema e curso.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {/* Feature 1 */}
                <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg sm:rounded-xl">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 text-sm sm:text-base">10 Cursos</h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Especializados em licitações e contratos
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg sm:rounded-xl">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 text-sm sm:text-base">Área Restrita</h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Acesso exclusivo para alunos via QR Code
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="text-center p-3 sm:p-4 bg-orange-50 rounded-lg sm:rounded-xl">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 text-sm sm:text-base">Materiais</h3>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Apostilas, acórdãos, pareceres e artigos
                  </p>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-2.5 sm:gap-3">
                <Link
                  href="/cursos"
                  onClick={handleExplore}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-3.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <span>Explorar Cursos</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>

                <button
                  onClick={handleClose}
                  className="w-full border-2 border-gray-300 text-gray-700 px-5 py-3.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl font-bold hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  Continuar Navegando
                </button>
              </div>

              <p className="text-center text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
                💡 Dica: Cadastre-se na newsletter para receber novos conteúdos
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
