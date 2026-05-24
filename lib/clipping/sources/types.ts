/**
 * Tipo unificado para itens do Clipping Diário multi-tribunal.
 *
 * Abstrai duas origens de dados:
 *  - `document-tcu`: TCU vive em `Document` com `category='acordao'` (modelo legado)
 *  - `tribunal-decision`: demais tribunais (TCE-PE, TCE-RS, TCE-SP, TCE-PR, TCE-SC,
 *     TCE-RJ, STJ via DataJud) vivem em `TribunalDecision` (modelo unificado)
 *
 * Pipeline de clipping consome `ClippingItem[]` agnóstico da origem, mas mantém
 * `sourceKind` + `sourceId` para resolver cache de extração/AI bullets.
 */
export interface ClippingItem {
  sourceKind: 'document-tcu' | 'tribunal-decision';
  sourceId: string;

  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;

  title: string;
  dataJulgamento: Date | null;
  relator: string | null;
  orgaoJulgador: string | null;

  ementa: string;
  fullText: string | null;

  linkExternal: string | null;
  linkPdf: string | null;

  relevanceScore: number | null;
  publishedAt: Date;
}

/**
 * Identificador composto para histórico de envio polimórfico.
 * Formato: "<kind>:<id>", usado em ClippingItemSentRef / DailyClippingSend.
 */
export function sentRefKey(item: Pick<ClippingItem, 'sourceKind' | 'sourceId'>): string {
  return `${item.sourceKind}:${item.sourceId}`;
}
