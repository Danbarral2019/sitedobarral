/**
 * Tema visual da pagina /legislacao conforme aba ativa.
 *
 * 4 abas: 'atos' | 'tic' | 'boas-praticas' | 'orientacoes', todas na paleta da marca.
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
    heroGradient: 'bg-brand-700',
    heroSubtitle: 'text-brand-100',
    tabActiveText: 'text-brand-700',
    tabActiveBadge: 'bg-brand-100 text-brand-700',
    tabHover: 'hover:text-brand-700',
    cardHoverBorder: 'hover:border-brand-300 hover:shadow-lg',
    themeChip: 'bg-brand-50 text-brand-700 border border-brand-200',
    summaryGradient: 'from-brand-50 via-brand-50 to-brand-50',
    summaryHeader: 'bg-brand-600',
    primaryActionBg: 'bg-brand-600 hover:bg-brand-700',
    spinnerBorder: 'border-brand-600',
    loadingMessage: 'Carregando legislação...',
    pageTitle: 'Atos Normativos',
    pageDescription: 'Legislação Relacionada à Lei 14.133/2021',
    pageLongDescription:
      'Explore decretos, portarias, instruções normativas e demais atos que regulamentam a Lei de Licitações e Contratos Administrativos.',
  },
  tic: {
    heroGradient: 'bg-brand-700',
    heroSubtitle: 'text-brand-100',
    tabActiveText: 'text-brand-700',
    tabActiveBadge: 'bg-brand-100 text-brand-700',
    tabHover: 'hover:text-brand-700',
    cardHoverBorder: 'hover:border-brand-300 hover:shadow-lg',
    themeChip: 'bg-brand-50 text-brand-700 border border-brand-200',
    summaryGradient: 'from-brand-50 via-brand-50 to-brand-50',
    summaryHeader: 'bg-brand-600',
    primaryActionBg: 'bg-brand-600 hover:bg-brand-700',
    spinnerBorder: 'border-brand-600',
    loadingMessage: 'Carregando legislação...',
    pageTitle: 'Contratações de TIC',
    pageDescription: 'Atos normativos de contratação de TIC (SGD/MGI)',
    pageLongDescription:
      'Instruções Normativas, Portarias e Decretos da Secretaria de Governo Digital para contratação de soluções de Tecnologia da Informação e Comunicação.',
  },
  'boas-praticas': {
    heroGradient: 'bg-brand-700',
    heroSubtitle: 'text-brand-100',
    tabActiveText: 'text-brand-700',
    tabActiveBadge: 'bg-brand-100 text-brand-700',
    tabHover: 'hover:text-brand-700',
    cardHoverBorder: 'hover:border-brand-300 hover:shadow-lg',
    themeChip: 'bg-brand-50 text-brand-700 border border-brand-200',
    summaryGradient: 'from-brand-50 via-brand-50 to-brand-50',
    summaryHeader: 'bg-brand-600',
    primaryActionBg: 'bg-brand-600 hover:bg-brand-700',
    spinnerBorder: 'border-brand-600',
    loadingMessage: 'Carregando outros atos normativos...',
    pageTitle: 'Outros Atos Normativos',
    pageDescription: 'Outros atos normativos relacionados a licitações e contratos',
    pageLongDescription:
      'Explore outros atos normativos de órgãos federais e estaduais relacionados a licitações e contratos administrativos.',
  },
  orientacoes: {
    // Âmbar fica reservado a referências (DESIGN.md), nunca a hero, aba ou
    // botão: sobre ele o texto branco ficava com 3,6:1.
    heroGradient: 'bg-brand-700',
    heroSubtitle: 'text-brand-100',
    tabActiveText: 'text-brand-700',
    tabActiveBadge: 'bg-brand-100 text-brand-700',
    tabHover: 'hover:text-brand-700',
    cardHoverBorder: 'hover:border-brand-300 hover:shadow-lg',
    themeChip: 'bg-brand-50 text-brand-700 border border-brand-200',
    summaryGradient: 'from-brand-50 via-brand-50 to-brand-50',
    summaryHeader: 'bg-brand-600',
    primaryActionBg: 'bg-brand-600 hover:bg-brand-700',
    spinnerBorder: 'border-brand-600',
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
