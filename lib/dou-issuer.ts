/**
 * Extrai o issuer canônico do hierarchyStr do DOU.
 *
 * Ordem importa: SEGES antes de MGI, porque atos da SEGES vêm como
 * "Ministério da Gestão e Inovação > SEGES" e o match em "gestão e
 * inovação" comeria SEGES se MGI viesse primeiro.
 *
 * Issuers retornados são canônicos (alinhados com normalizeIssuer in
 * lib/legislative-issuers ou similar). Default: 'Outro'.
 */
export function extractIssuerFromDouHierarchy(hierarchyStr: string): string {
  const h = (hierarchyStr || '').toLowerCase();
  if (h.includes('presidência') || h.includes('presidente')) return 'Presidência';
  if (h.includes('seges')) return 'SEGES';
  if (h.includes('mgi') || h.includes('gestão e inovação')) return 'MGI';
  if (h.includes('agu') || h.includes('advocacia')) return 'AGU';
  if (h.includes('cgu') || h.includes('controladoria')) return 'CGU';
  if (h.includes('tcu') || h.includes('tribunal de contas')) return 'TCU';
  if (h.includes('fazenda')) return 'Fazenda';
  return 'Outro';
}
