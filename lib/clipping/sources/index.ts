import { fetchTcuItems } from './tcu';
import { fetchTribunalItems } from './tribunal';
import type { ClippingItem } from './types';

export { sentRefKey } from './types';
export type { ClippingItem } from './types';
export { fetchTcuItems } from './tcu';
export { fetchTribunalItems } from './tribunal';

export interface FetchAllEligibleParams {
  /**
   * Lista de tribunais habilitados (CSV em env `CLIPPING_TRIBUNAIS_ENABLED`).
   * Ex.: ['TCU', 'TCE-PE', 'STJ']. 'TCU' usa pipeline Document; outros
   * usam pipeline TribunalDecision.
   */
  enabledTribunais: string[];
  /** Janela para TCU (geralmente últimas 24h em dias úteis). */
  tcuSince: Date;
  tcuUntil: Date;
  /** Janela em dias para tribunais não-TCU. Default 14. */
  windowDays: number;
  /** Set de keys "kind:id" já enviadas (rolling window). */
  alreadySentKeys: Set<string>;
  /** Limite por tribunal por edição. */
  maxItemsPerTribunal: number;
}

/**
 * Orquestra a coleta de todos os tribunais habilitados, retornando um Map
 * com chave `tribunalCode` → lista de itens elegíveis (já deduplicados
 * contra histórico).
 */
export async function fetchAllEligibleItems(
  params: FetchAllEligibleParams
): Promise<Map<string, ClippingItem[]>> {
  const {
    enabledTribunais,
    tcuSince,
    tcuUntil,
    windowDays,
    alreadySentKeys,
    maxItemsPerTribunal,
  } = params;

  const groups = new Map<string, ClippingItem[]>();

  for (const code of enabledTribunais) {
    let items: ClippingItem[];
    if (code === 'TCU') {
      items = await fetchTcuItems({
        since: tcuSince,
        until: tcuUntil,
        alreadySentKeys,
        limit: maxItemsPerTribunal,
      });
    } else {
      items = await fetchTribunalItems({
        tribunalCode: code,
        windowDays,
        alreadySentKeys,
        limit: maxItemsPerTribunal,
      });
    }
    if (items.length > 0) {
      groups.set(code, items);
    }
  }

  return groups;
}
