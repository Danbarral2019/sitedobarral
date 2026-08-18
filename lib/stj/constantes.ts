/** Portal de Dados Abertos do STJ (CKAN). */
export const BASE_DADOS_ABERTOS_STJ = 'https://dadosabertos.web.stj.jus.br';

/**
 * Órgãos coletados: onde o STJ julga direito público.
 *
 * Ficam de fora Segunda Seção e Terceira/Quarta Turma (direito privado) e
 * Terceira Seção e Quinta/Sexta Turma (penal). Rendimento medido em 12 dumps
 * amostrados: 117 relevantes em 2.497 acórdãos (4,7%).
 */
export const DATASETS_STJ = [
  { slug: 'espelhos-de-acordaos-corte-especial', orgao: 'Corte Especial' },
  { slug: 'espelhos-de-acordaos-primeira-secao', orgao: 'Primeira Seção' },
  { slug: 'espelhos-de-acordaos-primeira-turma', orgao: 'Primeira Turma' },
  { slug: 'espelhos-de-acordaos-segunda-turma', orgao: 'Segunda Turma' },
] as const;

export const TRIBUNAL_NAME_STJ = 'Superior Tribunal de Justiça';
export const SOURCE_API_STJ = 'stj-espelhos-dados-abertos';
export const SCRAPER_CODE_STJ = 'stj-espelhos';

/** Vocabulário do recorte — condição 2 do critério do spec. */
export const RE_VOCABULARIO_LICITACAO =
  /licita|contrato administrativo|preg[aã]o|dispensa de licita|inexigibilidade|concorr[eê]ncia p[uú]blica|tomada de pre[cç]o|contrata[cç][aã]o p[uú]blica/i;

/** Condição 1 — normas cuja citação basta para o espelho entrar. */
export const RE_NORMAS_LICITACAO = /LEI[-:]0*(14133|8666|10520)\b/i;
