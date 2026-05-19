/**
 * Tema visual da pagina /legislacao conforme aba ativa.
 *
 * 4 abas: 'atos' (blue) | 'tic' (cyan) | 'boas-praticas' (emerald) | 'orientacoes' (amber).
 * Centraliza as classes Tailwind que mudam por aba pra evitar ternarios verbosos
 * espalhados pelo componente.
 */

export type LegislacaoTab = 'atos' | 'boas-praticas' | 'tic' | 'orientacoes';

export interface LegislacaoTheme {
  heroGradient: string;
  heroSubtitle: string;
  tabActiveText: string;
  tabActiveBadge: string;
  tabHover: string;
  cardHoverBorder: string;
  themeChip: string;
  summaryGradient: string;
  summaryHeader: string;
  primaryActionBg: string;
  spinnerBorder: string;
  loadingMessage: string;
  pageTitle: string;
  pageDescription: string;
  pageLongDescription: string;
}

const THEMES: Record<LegislacaoTab, LegislacaoTheme> = {
  atos: {
    heroGradient: 'from-blue-600 to-indigo-700',
    heroSubtitle: 'text-blue-100',
    tabActiveText: 'text-blue-700',
    tabActiveBadge: 'bg-blue-100 text-blue-700',
    tabHover: 'hover:text-blue-700',
    cardHoverBorder: 'hover:border-blue-300 hover:shadow-lg',
    themeChip: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    summaryGradient: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50',
    summaryHeader: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    primaryActionBg: 'bg-blue-600 hover:bg-blue-700',
    spinnerBorder: 'border-blue-600',
    loadingMessage: 'Carregando legislação...',
    pageTitle: 'Atos Normativos',
    pageDescription: 'Legislação Relacionada à Lei 14.133/2021',
    pageLongDescription:
      'Explore decretos, portarias, instruções normativas e demais atos que regulamentam a Lei de Licitações e Contratos Administrativos.',
  },
  tic: {
    heroGradient: 'from-cyan-600 to-blue-700',
    heroSubtitle: 'text-cyan-100',
    tabActiveText: 'text-cyan-700',
    tabActiveBadge: 'bg-cyan-100 text-cyan-700',
    tabHover: 'hover:text-cyan-700',
    cardHoverBorder: 'hover:border-cyan-300 hover:shadow-lg',
    themeChip: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    summaryGradient: 'bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50',
    summaryHeader: 'bg-gradient-to-r from-cyan-600 to-blue-600',
    primaryActionBg: 'bg-cyan-600 hover:bg-cyan-700',
    spinnerBorder: 'border-cyan-600',
    loadingMessage: 'Carregando legislação...',
    pageTitle: 'Contratações de TIC',
    pageDescription: 'Atos normativos de contratação de TIC (SGD/MGI)',
    pageLongDescription:
      'Instruções Normativas, Portarias e Decretos da Secretaria de Governo Digital para contratação de soluções de Tecnologia da Informação e Comunicação.',
  },
  'boas-praticas': {
    heroGradient: 'from-emerald-600 to-teal-700',
    heroSubtitle: 'text-emerald-100',
    tabActiveText: 'text-emerald-700',
    tabActiveBadge: 'bg-emerald-100 text-emerald-700',
    tabHover: 'hover:text-emerald-700',
    cardHoverBorder: 'hover:border-emerald-300 hover:shadow-lg',
    themeChip: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    summaryGradient: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50',
    summaryHeader: 'bg-gradient-to-r from-emerald-600 to-teal-600',
    primaryActionBg: 'bg-emerald-600 hover:bg-emerald-700',
    spinnerBorder: 'border-emerald-600',
    loadingMessage: 'Carregando outros atos normativos...',
    pageTitle: 'Outros Atos Normativos',
    pageDescription: 'Outros atos normativos relacionados a licitações e contratos',
    pageLongDescription:
      'Explore outros atos normativos de órgãos federais e estaduais relacionados a licitações e contratos administrativos.',
  },
  orientacoes: {
    heroGradient: 'from-amber-600 to-orange-700',
    heroSubtitle: 'text-amber-100',
    tabActiveText: 'text-amber-700',
    tabActiveBadge: 'bg-amber-100 text-amber-700',
    tabHover: 'hover:text-amber-700',
    cardHoverBorder: 'hover:border-amber-300 hover:shadow-lg',
    themeChip: 'bg-amber-50 text-amber-700 border border-amber-200',
    summaryGradient: 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50',
    summaryHeader: 'bg-gradient-to-r from-amber-600 to-orange-600',
    primaryActionBg: 'bg-amber-600 hover:bg-amber-700',
    spinnerBorder: 'border-amber-600',
    loadingMessage: 'Carregando orientações...',
    pageTitle: 'Orientações e Procedimentos',
    pageDescription: 'Orientações práticas e cadernos de logística do Portal de Compras',
    pageLongDescription:
      'Orientações da SEGES/MGI e cadernos de logística com procedimentos práticos para gestores e agentes de contratação na Administração Pública Federal.',
  },
};

export function getTabTheme(tab: LegislacaoTab): LegislacaoTheme {
  return THEMES[tab];
}
