/** @deprecated Replaced by WelcomeBanner (2026-02-18) */
'use client';

import { useState, useEffect } from 'react';
import { X, Search, BookOpen, Scale, Sparkles, ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'barral-onboarding-dismissed';

const steps = [
  {
    icon: Search,
    title: 'Busque com IA',
    description: 'Use a barra de busca acima para encontrar qualquer conteudo. Ative a IA (icone roxo) para respostas contextualizadas.',
    color: 'from-brand-500 to-brand-500',
    bgColor: 'bg-brand-50',
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
    color: 'from-amber-accent to-amber-accent',
    bgColor: 'bg-amber-accent-soft',
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
    <div className="mb-6 bg-white rounded-[6px] border-2 border-brand-200 p-5 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-transparent rounded-bl-full opacity-60" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 rounded-[6px]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink-primary">Bem-vindo a Area Restrita!</h3>
              <p className="text-sm text-ink-muted">Veja o que voce pode fazer aqui</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="p-2 text-ink-muted hover:text-ink-secondary hover:bg-surface-deep rounded-[6px] transition-colors"
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
                className={`${step.bgColor} rounded-[6px] p-4 flex items-start gap-3 border border-white`}
              >
                <div className={`p-2 ${step.color} rounded-[6px] flex-shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-ink-primary text-sm">{step.title}</h4>
                  <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dismiss CTA */}
        <button
          onClick={dismiss}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white font-semibold text-sm rounded-[6px] hover:from-brand-600 hover:to-brand-700 transition-all"
        >
          Entendido, vamos comecar!
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
