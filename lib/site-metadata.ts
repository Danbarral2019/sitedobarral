import type { Metadata } from 'next';

/**
 * Modelo de título das páginas ("Termo | Prof. Daniel Barral").
 *
 * O Next só aplica o template do layout raiz enquanto nenhum layout
 * intermediário declara `title` como string: um layout com rotas filhas que
 * define o próprio título precisa repetir o template, senão os filhos perdem
 * o sufixo.
 */
export const TITLE_TEMPLATE = '%s | Prof. Daniel Barral';

/**
 * Páginas de conta, pagamento e descadastro: fora do índice, links seguidos.
 *
 * O `noindex` só funciona se o buscador puder rastrear a página. Bloqueada no
 * robots.txt, ela não é lida, e a URL pode aparecer nos resultados sem o
 * conteúdo. Por isso estas rotas não ficam no `disallow` de `app/robots.ts`.
 */
export const NOINDEX: Metadata['robots'] = { index: false, follow: true };
