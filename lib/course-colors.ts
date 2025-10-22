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
  { gradient: 'from-blue-300 to-blue-400', border: 'border-blue-300', bg: 'bg-blue-50' },     // Curso 01 - Azul muito claro
  { gradient: 'from-blue-400 to-blue-500', border: 'border-blue-400', bg: 'bg-blue-50' },     // Curso 02 - Azul claro
  { gradient: 'from-blue-500 to-blue-600', border: 'border-blue-500', bg: 'bg-blue-50' },     // Curso 03 - Azul claro-médio
  { gradient: 'from-blue-600 to-blue-700', border: 'border-blue-600', bg: 'bg-blue-100' },    // Curso 04 - Azul médio
  { gradient: 'from-blue-700 to-blue-800', border: 'border-blue-700', bg: 'bg-blue-100' },    // Curso 05 - Azul médio-escuro
  { gradient: 'from-blue-800 to-blue-900', border: 'border-blue-800', bg: 'bg-blue-100' },    // Curso 06 - Azul escuro
  { gradient: 'from-sky-600 to-sky-700', border: 'border-sky-600', bg: 'bg-sky-50' },         // Curso 07 - Sky médio
  { gradient: 'from-sky-700 to-sky-800', border: 'border-sky-700', bg: 'bg-sky-100' },        // Curso 08 - Sky escuro
  { gradient: 'from-indigo-700 to-indigo-800', border: 'border-indigo-700', bg: 'bg-indigo-50' }, // Curso 09 - Indigo escuro
  { gradient: 'from-indigo-800 to-indigo-900', border: 'border-indigo-800', bg: 'bg-indigo-100' }, // Curso 10 - Indigo muito escuro
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
  { bg: 'bg-blue-100', text: 'text-blue-800' },
  { bg: 'bg-green-100', text: 'text-green-800' },
  { bg: 'bg-purple-100', text: 'text-purple-800' },
  { bg: 'bg-pink-100', text: 'text-pink-800' },
  { bg: 'bg-orange-100', text: 'text-orange-800' },
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
