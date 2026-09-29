/**
 * Modelo de título das páginas ("Termo | Prof. Daniel Barral").
 *
 * O Next só aplica o template do layout raiz enquanto nenhum layout
 * intermediário declara `title` como string: um layout com rotas filhas que
 * define o próprio título precisa repetir o template, senão os filhos perdem
 * o sufixo.
 */
export const TITLE_TEMPLATE = '%s | Prof. Daniel Barral';
