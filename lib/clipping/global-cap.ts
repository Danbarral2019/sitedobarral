import type { ClippingItem } from './sources/types';

/**
 * Aplica cap global `MAX_TOTAL` repartindo as vagas entre os tribunais em
 * rodízio: a primeira decisão de cada tribunal, depois a segunda, e assim por
 * diante, na ordem de `CLIPPING_TRIBUNAIS_ENABLED`. Dentro de cada tribunal a
 * ordem de relevância da fonte é preservada.
 *
 * Não ordena por `relevanceScore` entre tribunais: as escalas não se comparam
 * (TCU usa `analyzeRelevanceTCU`, com corte em 15; os demais usam o
 * classificador, com corte em 55 e muitos itens em 100). Pela ordenação
 * global, o TCU saía do clipping sempre que outros tribunais tinham material.
 */
export function applyGlobalCap(groups: Map<string, ClippingItem[]>, maxTotal: number): Map<string, ClippingItem[]> {
  let total = 0;
  for (const items of groups.values()) total += items.length;
  if (total <= maxTotal) return groups;

  const result = new Map<string, ClippingItem[]>();
  let kept = 0;
  for (let round = 0; kept < maxTotal; round++) {
    let tookAny = false;
    for (const [code, items] of groups) {
      if (kept >= maxTotal) break;
      const item = items[round];
      if (!item) continue;
      const list = result.get(code) || [];
      list.push(item);
      result.set(code, list);
      kept++;
      tookAny = true;
    }
    if (!tookAny) break;
  }
  return result;
}
