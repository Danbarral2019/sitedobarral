/**
 * Mapeamento de cores para cursos e posts do blog
 * Centraliza a lógica de atribuição de cores para melhor manutenibilidade
 */

/**
 * Esquema de cores para um item (curso ou post)
 */
export interface ColorScheme {
  gradient: string;
  border: string;
  bg: string;
}

/**
 * Paleta de cores para cursos
 * Progressão de azuis claros para escuros (10 variações)
 */
export const COURSE_COLORS: ColorScheme[] = [
  { gradient: 'bg-brand-400', border: 'border-brand-300', bg: 'bg-brand-50' },     // Curso 01 - Azul muito claro
  { gradient: 'bg-brand-500', border: 'border-brand-400', bg: 'bg-brand-50' },     // Curso 02 - Azul claro
  { gradient: 'bg-brand-600', border: 'border-brand-500', bg: 'bg-brand-50' },     // Curso 03 - Azul claro-médio
  { gradient: 'bg-brand-700', border: 'border-brand-600', bg: 'bg-brand-100' },    // Curso 04 - Azul médio
  { gradient: 'bg-brand-800', border: 'border-brand-700', bg: 'bg-brand-100' },    // Curso 05 - Azul médio-escuro
  { gradient: 'bg-brand-900', border: 'border-brand-800', bg: 'bg-brand-100' },    // Curso 06 - Azul escuro
  { gradient: 'bg-brand-700', border: 'border-brand-600', bg: 'bg-brand-50' },         // Curso 07 - Sky médio
  { gradient: 'bg-brand-800', border: 'border-brand-700', bg: 'bg-brand-100' },        // Curso 08 - Sky escuro
  { gradient: 'bg-brand-800', border: 'border-brand-700', bg: 'bg-brand-50' }, // Curso 09 - Indigo escuro
  { gradient: 'bg-brand-900', border: 'border-brand-800', bg: 'bg-brand-100' }, // Curso 10 - Indigo muito escuro
];

/**
 * Cores para borda esquerda de posts do blog (5 variações)
 */
export const BLOG_POST_BORDER_COLORS: string[] = [
  'border-l-blue-500',
  'border-l-green-500',
  'border-l-purple-500',
  'border-l-pink-500',
  'border-l-orange-500',
];

/**
 * Interface para esquema de cores de tags
 */
export interface TagColorScheme {
  bg: string;
  text: string;
}

/**
 * Cores para tags de posts do blog (5 variações)
 */
export const BLOG_POST_TAG_COLORS: TagColorScheme[] = [
  { bg: 'bg-brand-100', text: 'text-brand-800' },
  { bg: 'bg-green-100', text: 'text-green-800' },
  { bg: 'bg-brand-100', text: 'text-brand-800' },
  { bg: 'bg-brand-100', text: 'text-brand-800' },
  { bg: 'bg-amber-accent-soft', text: 'text-amber-accent-deep' },
];

/**
 * Obtém o esquema de cores para um curso baseado no índice
 *
 * @param index - Índice do curso (0-based)
 * @returns Esquema de cores do curso
 */
export function getCourseColor(index: number): ColorScheme {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}

/**
 * Obtém a cor de borda para um post do blog baseado no índice
 *
 * @param index - Índice do post (0-based)
 * @returns Classe CSS da cor de borda
 */
export function getBlogPostBorderColor(index: number): string {
  return BLOG_POST_BORDER_COLORS[index % BLOG_POST_BORDER_COLORS.length];
}

/**
 * Obtém o esquema de cores para uma tag baseado no índice
 *
 * @param index - Índice da tag (0-based)
 * @returns Esquema de cores da tag
 */
export function getBlogPostTagColor(index: number): TagColorScheme {
  return BLOG_POST_TAG_COLORS[index % BLOG_POST_TAG_COLORS.length];
}
