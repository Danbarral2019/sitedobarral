/**
 * Remoção da redação superada nos textos compilados do Planalto.
 *
 * No texto compilado, o Planalto mantém a redação antiga riscada (`<strike>`)
 * ao lado da vigente:
 *
 *   <p><strike>III - criador: pesquisador que seja inventor...;</strike></p>
 *   <p>III - criador: pessoa física que seja inventora...; <a>(Redação pela Lei nº 13.243, de 2016)</a></p>
 *
 * Extraído como texto, o risco some e o dispositivo aparece duas vezes, a
 * redação antiga como se estivesse em vigor. Aqui o trecho riscado sai antes
 * da extração. Quando o dispositivo inteiro foi revogado, o rótulo fica, para
 * a nota não perder a referência:
 *
 *   <p><strike>I - produzidos ou prestados por empresas...;</strike> <a>(Revogado pela Lei nº 12.349, de 2010)</a></p>
 *   → "I - (Revogado pela Lei nº 12.349, de 2010)"
 */
import type * as cheerio from 'cheerio';

const STRUCK_SELECTOR = 'strike, s, del';
const BLOCK_SELECTOR = 'p, div, td, li, h1, h2, h3, h4, h5, h6, blockquote';

/** Rótulo do dispositivo no começo do trecho: artigo, parágrafo, inciso ou alínea. */
const LABEL_RE =
  /^\s*(Art\.\s*\d[\d.]*\s*[ºo°]?(?:-[A-Z])?\.?|§\s*\d+\s*[ºo°]?(?:-[A-Z])?\.?|Par[áa]grafo\s+[úu]nico\.?|[IVXLCDM]+(?:-[A-Z])?\s*[-–—]|[a-z]\))/;

function isStruckByStyle(style: string | undefined): boolean {
  return Boolean(style && /line-through/i.test(style));
}

/**
 * Remove do documento o texto riscado. Devolve quantos trechos saíram.
 * Altera `$` no lugar.
 */
export function removerTextoRiscado($: cheerio.Root): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = $ as any;
  const struck = q(STRUCK_SELECTOR)
    .toArray()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .concat(q('[style]').toArray().filter((el: any) => isStruckByStyle(q(el).attr('style'))))
    // Só os mais externos: o riscado dentro de outro riscado sai junto.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((el: any) => q(el).parents(STRUCK_SELECTOR).length === 0 && !q(el).parents().toArray().some((p: any) => isStruckByStyle(q(p).attr('style'))));

  if (struck.length === 0) return 0;

  // Agrupa por bloco (parágrafo) para decidir o que sobra de cada um.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byBlock = new Map<any, any[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose: any[] = [];
  for (const el of struck) {
    const block = q(el).closest(BLOCK_SELECTOR).get(0);
    if (!block) {
      loose.push(el);
      continue;
    }
    const list = byBlock.get(block) ?? [];
    list.push(el);
    byBlock.set(block, list);
  }

  for (const [block, els] of byBlock) {
    const $block = q(block);
    const blockStart = $block.text().replace(/\s+/g, ' ').trim();
    const firstStruck = q(els[0]).text().replace(/\s+/g, ' ').trim();
    const label = firstStruck.match(LABEL_RE)?.[1];
    const startsStruck = firstStruck.length > 0 && blockStart.startsWith(firstStruck.slice(0, 20));

    for (const el of els) q(el).remove();

    const rest = $block.text().replace(/\s+/g, ' ').trim();
    if (!rest) {
      $block.remove();
    } else if (label && startsStruck && rest.startsWith('(')) {
      // Dispositivo revogado: "I - (Revogado pela Lei ...)".
      $block.prepend(`${label} `);
    }
  }

  for (const el of loose) q(el).remove();
  return struck.length;
}
