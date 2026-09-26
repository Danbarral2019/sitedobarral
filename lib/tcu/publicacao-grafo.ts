/**
 * Quando um acórdão do grafo de precedentes vira acervo público.
 *
 * O backfill retroativo (lib/tcu/backfill-retroativo.ts) ingere acórdãos do TCU
 * de QUALQUER assunto, porque o grafo precisa dos acórdãos que CITAM os leading
 * cases, e não só dos que tratam de licitação. Medido em 26/09/2026 sobre os
 * 13.395 do grafo: ~72% são tomada de contas especial, aposentadoria, pensão e
 * pessoal. Esses continuam combustível invisível.
 *
 * Decisão do Daniel (26/09/2026): vira acervo público o acórdão do grafo cujo
 * inteiro teor cita uma lei de licitações e contratos. "Promover" é passar para
 * a categoria curada `acordao`, que as superfícies do site já exibem, com
 * `isPublic` e `isCommon`. As filas do TCU enxergam as duas categorias
 * (CATEGORIAS_ACORDAO), então nada muda no processamento. A proveniência fica em
 * `reviewedBy: 'backfill-grafo'`, que o backfill grava e a promoção não toca.
 *
 * O mesmo padrão vale em JS (catalogação de cada acórdão novo) e em SQL (passivo,
 * scripts/promover-grafo-licitacao.ts), por isso é uma string só, na sintaxe comum
 * às duas: sem lookbehind, sem flags embutidas.
 */
import { CATEGORIA_GRAFO } from './backfill-retroativo';

/** Leis de licitações e contratos: 14.133, 8.666, 10.520 (pregão), 12.462 (RDC), 13.303 (estatais). */
export const PADRAO_LEI_DE_LICITACAO =
  'lei[[:space:]]*(n[º°o.]*[[:space:]]*)?(14[.]?133|8[.]?666|10[.]?520|12[.]?462|13[.]?303)';

/** Versão JS do mesmo padrão (a classe POSIX [[:space:]] vira \s). */
const REGEX_LEI_DE_LICITACAO = new RegExp(PADRAO_LEI_DE_LICITACAO.replace(/\[\[:space:\]\]/g, '\\s'), 'i');

export function citaLeiDeLicitacao(texto: string | null | undefined): boolean {
  return !!texto && REGEX_LEI_DE_LICITACAO.test(texto);
}

/** Categorias curadas com que um acórdão promovido não pode duplicar. */
export const CATEGORIAS_CURADAS_TCU = ['acordao', 'consulta_tcu'] as const;

/** Tags do backfill com o marcador interno "grafo" removido (as tags aparecem na página). */
export function tagsPublicas(tags: string | null): string | null {
  if (!tags) return tags;
  try {
    const arr = JSON.parse(tags);
    return Array.isArray(arr) ? JSON.stringify(arr.filter((t) => t !== 'grafo')) : tags;
  } catch {
    return tags;
  }
}

export function dadosDePromocao(tags: string | null) {
  return {
    category: 'acordao',
    isPublic: true,
    isCommon: true,
    tags: tagsPublicas(tags),
  };
}

export interface CandidatoPromocao {
  category: string;
  tcuTextoCompleto: string | null;
  /** Há acórdão curado com a mesma URL (mesmo número, ano e colegiado)? */
  duplicaCurado: boolean;
}

export function devePromover(c: CandidatoPromocao): boolean {
  return c.category === CATEGORIA_GRAFO && !c.duplicaCurado && citaLeiDeLicitacao(c.tcuTextoCompleto);
}
