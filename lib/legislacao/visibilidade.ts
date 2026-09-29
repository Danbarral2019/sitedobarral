/**
 * Quais atos aparecem nas visões públicas (listagem, busca, contagens).
 *
 * Ato revogado sai delas e fica acessível só por link direto, com aviso. A
 * exceção é o revogado ainda de consulta corrente (`revokedVisible`), como a
 * Lei 8.666/1993, que rege os contratos da transição: segue visível, com o
 * mesmo aviso.
 */
export const ATO_VISIVEL = { NOT: { revoked: true, revokedVisible: false } };

/** O mesmo predicado em SQL; `alias` é o da tabela "LegislativeAct" na consulta. */
export function atoVisivelSql(alias?: string): string {
  const col = (c: string) => (alias ? `${alias}."${c}"` : `"${c}"`);
  return `NOT (${col('revoked')} AND NOT ${col('revokedVisible')})`;
}
