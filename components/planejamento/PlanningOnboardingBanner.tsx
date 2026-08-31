'use client';

import { useState, useEffect } from 'react';
import { X, FileText, GitBranch, Scale, History, ChevronRight, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'barral-planning-onboarding-dismissed';

const steps = [
  {
    icon: FileText,
    title: 'Cada contratação é uma sessão',
    description: 'Você descreve em linguagem natural o que precisa contratar. O assistente identifica a natureza (bem, serviço, obra) e sugere a trilha adequada.',
    color: 'from-brand-500 to-brand-600',
    bgColor: 'bg-brand-50',
  },
  {
    icon: GitBranch,
    title: 'Trilhas guiadas: ETP e TR',
    description: 'Elabore o Estudo Técnico Preliminar passo a passo. Quando o ETP estiver completo, libere o Termo de Referência com seções derivadas automaticamente.',
    color: 'from-brand-500 to-brand-600',
    bgColor: 'bg-brand-50',
  },
  {
    icon: Scale,
    title: 'Matriz de modalidade',
    description: 'Decida pregão eletrônico, concorrência, dispensa ou inexigibilidade com base nas características do objeto. A matriz justifica a escolha em texto pronto para colar no processo.',
    color: 'from-amber-accent to-amber-accent',
    bgColor: 'bg-amber-accent-soft',
  },
  {
    icon: History,
    title: 'Versionamento e exportação',
    description: 'Cada confirmação de seção gera uma versão. Você consulta o histórico, revisa o documento final e exporta em DOCX/PDF quando estiver pronto.',
    color: 'from-emerald-500 to-green-600',
    bgColor: 'bg-emerald-50',
  },
];

interface Props {
  showByDefault?: boolean;
}

export default function PlanningOnboardingBanner({ showByDefault = true }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!showByDefault) return;
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage indisponível
    }
  }, [showByDefault]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage indisponível
    }
  };

  if (!visible) return null;

  return (
    <div className="mb-6 bg-white rounded-[6px] border-2 border-brand-200 p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-transparent rounded-bl-full opacity-60" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-700 rounded-[6px]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink-primary">
                Como funciona o Planejamento da Contratação
              </h3>
              <p className="text-sm text-ink-muted">
                Quatro passos para conduzir do ETP ao TR com base na Lei 14.133
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="p-2 text-ink-muted hover:text-ink-secondary hover:bg-surface-deep rounded-[6px] transition-colors"
            aria-label="Fechar guia de onboarding"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                  <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={dismiss}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-700 text-white font-semibold text-sm rounded-[6px] hover:from-brand-800 hover:to-brand-700 transition-all"
        >
          Entendi, vamos começar
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
