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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full pointer-events-auto transform transition-all duration-300 scale-100 opacity-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 p-8 rounded-t-2xl">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                aria-label="Fechar modal"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h2 id="welcome-title" className="text-3xl font-bold text-white mb-2">
                  Bem-vindo ao Site do Prof. Daniel Barral
                </h2>
                <p className="text-blue-100 text-lg">
                  Especialista em Licitações e Contratos Administrativos
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              <p className="text-gray-700 text-lg mb-6 text-center">
                Repositório especializado de materiais jurídicos em Direito Administrativo,
                organizados por tema e curso.
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {/* Feature 1 */}
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">10 Cursos</h3>
                  <p className="text-sm text-gray-600">
                    Especializados em licitações e contratos
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="text-center p-4 bg-purple-50 rounded-xl">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Área Restrita</h3>
                  <p className="text-sm text-gray-600">
                    Acesso exclusivo para alunos via QR Code
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="text-center p-4 bg-orange-50 rounded-xl">
                  <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Materiais</h3>
                  <p className="text-sm text-gray-600">
                    Apostilas, acórdãos, pareceres e artigos
                  </p>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/cursos"
                  onClick={handleExplore}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <span>Explorar Cursos</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <button
                  onClick={handleClose}
                  className="flex-1 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                >
                  Continuar Navegando
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-4">
                💡 Dica: Cadastre-se na newsletter para receber novos conteúdos
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
