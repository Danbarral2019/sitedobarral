/** Portal de Dados Abertos do STJ (CKAN). */
export const BASE_DADOS_ABERTOS_STJ = 'https://dadosabertos.web.stj.jus.br';

/**
 * Órgãos coletados: onde o STJ julga direito público.
 *
 * Ficam de fora Segunda Seção e Terceira/Quarta Turma (direito privado) e
 * Terceira Seção e Quinta/Sexta Turma (penal). Rendimento medido em 12 dumps
 * amostrados: 82 relevantes em 2.497 acórdãos (3,3%).
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

/**
 * Vocabulário do recorte — condição 2 do critério do spec.
 *
 * Cada termo é ancorado em `\b` por medição, não por estilo: sem a âncora,
 * `licita` casa dentro de "explicitação", "explicitamente" e "implicitamente",
 * o que respondia por 29% do recorte (33 falsos positivos em 115).
 *
 * `\blicita` ainda casa "licitamente" (advérbio: "prova obtida licitamente"),
 * que não é tema de licitação. A exclusão `(?!mente\b)` é preventiva — não foi
 * observada em 698 espelhos reais (apenas palavras temáticas: licitação 11,
 * licitar 8, licitatórios 8, licitantes 3, licitatória 1), mas "licitamente" é
 * português jurídico válido e a amostra cobre < 2% do acervo do backfill.
 *
 * `inexigibilidade` exige o complemento "de licitação" — isolado, casa "ação
 * declaratória de inexigibilidade de débito", alheia ao tema.
 */
export const RE_VOCABULARIO_LICITACAO =
  /\blicita(?!mente\b)|\bcontrato administrativo|\bpreg[aã]o|\bdispensa de licita|\binexigibilidade de licita|\bconcorr[eê]ncia p[uú]blica|\btomada de pre[cç]o|\bcontrata[cç][aã]o p[uú]blica/i;

/** Condição 1 — normas cuja citação basta para o espelho entrar. */
export const RE_NORMAS_LICITACAO = /LEI[-:]0*(14133|8666|10520)\b/i;
