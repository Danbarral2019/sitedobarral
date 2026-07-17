/**
 * Termos-chave por artigo da Lei 14.133 — o que procurar no inteiro teor.
 *
 * Existe porque os acórdãos **citam o princípio, não o artigo**. Um voto
 * discute economicidade por páginas escrevendo "princípio da economicidade" e
 * jamais "art. 5º da Lei 14.133". Medido no spike de 15/07: 0 de 6 acórdãos
 * vinculados ao art. 5º citam o artigo, nem no inteiro teor.
 *
 * Para artigos que não são listas de termos nomeados, a citação direta do
 * artigo (lib/lei-14133/citation-extractor.ts) já resolve — não precisam
 * entrar aqui.
 *
 * Ref.: docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md
 */

/** Os 22 princípios nomeados no caput do art. 5º, na ordem da lei. */
const PRINCIPIOS_ART_5 = [
  'legalidade',
  'impessoalidade',
  'moralidade',
  'publicidade',
  'eficiência',
  'interesse público',
  'probidade administrativa',
  'igualdade',
  'planejamento',
  'transparência',
  'eficácia',
  'segregação de funções',
  'motivação',
  'vinculação ao edital',
  'julgamento objetivo',
  'segurança jurídica',
  'razoabilidade',
  'competitividade',
  'proporcionalidade',
  'celeridade',
  'economicidade',
  'desenvolvimento nacional sustentável',
];

export const TERMOS_POR_ARTIGO: Record<string, string[]> = {
  '5': PRINCIPIOS_ART_5,
};
