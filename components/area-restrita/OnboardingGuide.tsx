'use client';

import { useState, useEffect } from 'react';
import { X, Search, BookOpen, Scale, Sparkles, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'barral-onboarding-dismissed';

const steps = [
  {
    icon: Search,
    title: 'Busque com IA',
    description: 'Use a barra de busca acima para encontrar qualquer conteudo. Ative a IA (icone roxo) para respostas contextualizadas.',
    color: 'from-purple-500 to-indigo-500',
    bgColor: 'bg-purple-50',
  },
  {
    icon: Scale,
    title: 'Explore a Lei 14.133',
    description: 'Navegue pelos 195 artigos comentados com jurisprudencia do TCU e pareceres da AGU.',
    color: 'from-brand-500 to-brand-600',
    bgColor: 'bg-brand-50',
  },
  {
    icon: BookOpen,
    title: 'Acesse seus Cursos',
    description: 'Role para baixo para ver os cursos matriculados com modulos, aulas, quizzes e certificados.',
    color: 'from-emerald-500 to-green-600',
    bgColor: 'bg-emerald-50',
  },
  {
    icon: Sparkles,
    title: 'Assistente Juridico IA',
    description: 'Tire duvidas sobre licitacoes a qualquer momento usando o assistente inteligente.',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
  },
];

export default function OnboardingGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage not available
    }
  };

  if (!visible) return null;

  return (
    <div className="mb-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-2xl border-2 border-indigo-200 p-5 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-indigo-100 to-transparent rounded-bl-full opacity-60" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Bem-vindo a Area Restrita!</h3>
              <p className="text-sm text-gray-500">Veja o que voce pode fazer aqui</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fechar guia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className={`${step.bgColor} rounded-xl p-4 flex items-start gap-3 border border-white`}
              >
                <div className={`p-2 bg-gradient-to-br ${step.color} rounded-lg flex-shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{step.title}</h4>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dismiss CTA */}
        <button
          onClick={dismiss}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all"
        >
          Entendido, vamos comecar!
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
