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

/**
 * Tema por aba da /legislacao.
 *
 * As cores foram removidas de proposito. Cada aba tinha o seu proprio
 * gradiente de topo (azul, ciano, esmeralda, ambar) e a sua propria cor de
 * chip e de botao, o que o DESIGN.md nomeia como anti-referencia: paleta
 * presa a qual ente publicou. O que distingue as abas e o rotulo e a
 * contagem, nao a cor. Os campos ficam na interface para nao quebrar os
 * consumidores, apontando todos para os tokens do sistema.
 */
const THEMES: Record<LegislacaoTab, LegislacaoTheme> = {
  atos: {
    heroGradient: '',
    heroSubtitle: 'text-ink-secondary',
    tabActiveText: 'text-brand-700',
    tabActiveBadge: 'bg-surface-deep text-ink-secondary',
    tabHover: 'hover:text-brand-700',
    cardHoverBorder: 'hover:border-border-strong',
    themeChip: 'bg-surface-raised text-ink-secondary border border-border-subtle',
    summaryGradient: 'bg-surface-raised',
    summaryHeader: 'bg-brand-600',
    primaryActionBg: 'bg-brand-600 hover:bg-brand-800',
    spinnerBorder: 'border-brand-600',
    loadingMessage: 'Carregando legislação...',
    pageTitle: 'Atos Normativos',
    pageDescription: 'Legislação Relacionada à Lei 14.133/2021',
    pageLongDescription:
      'Explore decretos, portarias, instruções normativas e demais atos que regulamentam a Lei de Licitações e Contratos Administrativos.',
  },
  tic: {
    heroGradient: '',
    heroSubtitle: 'text-ink-secondary',
    tabActiveText: 'text-brand-700',
    tabActiveBadge: 'bg-surface-deep text-ink-secondary',
    tabHover: 'hover:text-brand-700',
    cardHoverBorder: 'hover:border-border-strong',
    themeChip: 'bg-surface-raised text-ink-secondary border border-border-subtle',
    summaryGradient: 'bg-surface-raised',
    summaryHeader: 'bg-brand-600',
    primaryActionBg: 'bg-brand-600 hover:bg-brand-800',
    spinnerBorder: 'border-brand-600',
    loadingMessage: 'Carregando legislação...',
    pageTitle: 'Contratações de TIC',
    pageDescription: 'Atos normativos de contratação de TIC (SGD/MGI)',
    pageLongDescription:
      'Instruções Normativas, Portarias e Decretos da Secretaria de Governo Digital para contratação de soluções de Tecnologia da Informação e Comunicação.',
  },
  'boas-praticas': {
    heroGradient: '',
    heroSubtitle: 'text-ink-secondary',
    tabActiveText: 'text-brand-700',
    tabActiveBadge: 'bg-surface-deep text-ink-secondary',
    tabHover: 'hover:text-brand-700',
    cardHoverBorder: 'hover:border-border-strong',
    themeChip: 'bg-surface-raised text-ink-secondary border border-border-subtle',
    summaryGradient: 'bg-surface-raised',
    summaryHeader: 'bg-brand-600',
    primaryActionBg: 'bg-brand-600 hover:bg-brand-800',
    spinnerBorder: 'border-brand-600',
    loadingMessage: 'Carregando outros atos normativos...',
    pageTitle: 'Outros Atos Normativos',
    pageDescription: 'Outros atos normativos relacionados a licitações e contratos',
    pageLongDescription:
      'Explore outros atos normativos de órgãos federais e estaduais relacionados a licitações e contratos administrativos.',
  },
  orientacoes: {
    heroGradient: '',
    heroSubtitle: 'text-ink-secondary',
    tabActiveText: 'text-brand-700',
    tabActiveBadge: 'bg-surface-deep text-ink-secondary',
    tabHover: 'hover:text-brand-700',
    cardHoverBorder: 'hover:border-border-strong',
    themeChip: 'bg-surface-raised text-ink-secondary border border-border-subtle',
    summaryGradient: 'bg-surface-raised',
    summaryHeader: 'bg-brand-600',
    primaryActionBg: 'bg-brand-600 hover:bg-brand-800',
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
