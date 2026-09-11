/**
 * Utilidades para trabalhar com artigos da Lei 14.133/2021
 *
 * Módulo puro, importado por componentes de cliente: NÃO importe o Prisma
 * aqui (issue #212). As funções de analytics que consultam o banco vivem em
 * `lib/article-analytics.ts`.
 *
 * NOTA DE PERFORMANCE: este módulo NÃO importa LEI_14133_ARTIGOS no top-level
 * porque o mapa pesa ~329 KB e seria incluído no bundle de qualquer rota que
 * importasse este arquivo. Componentes client devem usar o hook
 * `useLeiArticles()` de `hooks/useLeiArticles.ts`.
 */

import { parseLeiArticles } from './lei-articles';

/**
 * Extrai números de artigos de um documento (campo leiArticles em JSON).
 * Wrapper sobre `parseLeiArticles` mantido por retrocompatibilidade.
 * @deprecated Use `parseLeiArticles` de `@/lib/lei-articles` diretamente.
 */
export function extractArticleNumbers(leiArticlesJson: string | string[] | null): string[] {
  return parseLeiArticles(leiArticlesJson);
}

/**
 * Formata número de artigo para exibição
 */
export function formatArticleNumber(numero: string): string {
  return `Art. ${numero}`;
}

/**
 * Obtém cor do badge por seção da lei (para UI)
 */
export function getArticleColor(numero: string): string {
  const num = parseInt(numero);

  if (num >= 1 && num <= 17) return 'blue';      // Disposições Gerais
  if (num >= 18 && num <= 71) return 'green';    // Licitações
  if (num >= 72 && num <= 88) return 'yellow';   // Contratação Direta + Aux
  if (num >= 89 && num <= 154) return 'orange';  // Contratos
  if (num >= 155 && num <= 173) return 'red';    // Sanções
  if (num >= 174 && num <= 193) return 'purple'; // Instrumentos Auxiliares + Finais

  return 'gray';
}

/**
 * Obtém classes CSS do badge baseado na cor
 */
export function getArticleBadgeClasses(numero: string, isPrimary: boolean = false): string {
  const color = getArticleColor(numero);
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';

  if (isPrimary) {
    const colorClasses = {
      blue: 'bg-brand-600 text-white',
      green: 'bg-green-600 text-white',
      yellow: 'bg-amber-accent text-white',
      orange: 'bg-amber-accent text-white',
      red: 'bg-red-600 text-white',
      purple: 'bg-brand-600 text-white',
      gray: 'bg-brand-800 text-white',
    };
    return `${base} ${colorClasses[color as keyof typeof colorClasses]}`;
  } else {
    const colorClasses = {
      blue: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
      green: 'bg-green-100 text-green-800 hover:bg-green-200',
      yellow: 'bg-amber-accent-soft text-amber-accent-deep hover:bg-amber-accent-soft',
      orange: 'bg-amber-accent-soft text-amber-accent-deep hover:bg-amber-accent-soft',
      red: 'bg-red-100 text-red-800 hover:bg-red-200',
      purple: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
      gray: 'bg-surface-deep text-ink-secondary hover:bg-surface-deep',
    };
    return `${base} ${colorClasses[color as keyof typeof colorClasses]} cursor-pointer transition-colors`;
  }
}

/**
 * Obtém ícone contextual baseado na seção do artigo
 */
export function getArticleIcon(numero: string): string {
  const num = parseInt(numero);

  if (num >= 1 && num <= 17) return '📋';
  if (num >= 18 && num <= 71) return '🏛️';
  if (num >= 72 && num <= 88) return '⚡';
  if (num >= 89 && num <= 154) return '📝';
  if (num >= 155 && num <= 173) return '⚖️';
  if (num >= 174 && num <= 193) return '🔧';

  return '📄';
}
