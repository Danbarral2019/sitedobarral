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
 color: '',
 bgColor: 'bg-surface-raised',
 },
 {
 icon: Scale,
 title: 'Explore a Lei 14.133',
 description: 'Navegue pelos 195 artigos comentados com jurisprudencia do TCU e pareceres da AGU.',
 color: '',
 bgColor: 'bg-brand-50',
 },
 {
 icon: BookOpen,
 title: 'Acesse seus Cursos',
 description: 'Role para baixo para ver os cursos matriculados com modulos, aulas, quizzes e certificados.',
 color: '',
 bgColor: 'bg-surface-raised',
 },
 {
 icon: Sparkles,
 title: 'Assistente Juridico IA',
 description: 'Tire duvidas sobre licitacoes a qualquer momento usando o assistente inteligente.',
 color: '',
 bgColor: 'bg-surface-raised',
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
 <div className="mb-6 bg-surface-raised rounded-md border border-border-subtle p-5 relative overflow-hidden">
 {/* Background decoration */}
 <div className="absolute top-0 right-0 w-40 h-40 bg-surface-raised rounded-bl-full opacity-60" />

 <div className="relative z-10">
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-surface-raised rounded-md">
 <Sparkles className="w-5 h-5 text-surface-page" />
 </div>
 <div>
 <h3 className="text-lg font-bold text-ink-primary">Bem-vindo a Area Restrita!</h3>
 <p className="text-sm text-ink-muted">Veja o que voce pode fazer aqui</p>
 </div>
 </div>
 <button
 onClick={dismiss}
 className="p-2 text-ink-muted hover:text-ink-secondary hover:bg-surface-deep rounded-[3px] transition-colors"
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
 className={`${step.bgColor} rounded-md p-4 flex items-start gap-3 border border-white`}
 >
 <div className={`p-2 bg-brand-600 rounded-[3px] flex-shrink-0`}>
 <Icon className="w-4 h-4 text-surface-page" />
 </div>
 <div>
 <h4 className="font-semibold text-ink-primary text-sm">{step.title}</h4>
 <p className="text-xs text-ink-secondary mt-0.5 leading-relaxed">{step.description}</p>
 </div>
 </div>
 );
 })}
 </div>

 {/* Dismiss CTA */}
 <button
 onClick={dismiss}
 className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-surface-page font-semibold text-sm rounded-md hover: transition-all"
 >
 Entendido, vamos comecar!
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 );
}
