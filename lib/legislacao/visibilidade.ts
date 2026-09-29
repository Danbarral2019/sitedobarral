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

/**
 * Ressalva que acompanha o texto de ato revogado no contexto do assistente e
 * nos resultados de busca, para o ato visível (Lei 8.666/1993) não ser lido
 * como norma em vigor. Vazia para ato vigente.
 */
export function ressalvaDeRevogacao(revoked: boolean, nota: string | null | undefined): string {
  if (!revoked) return '';
  const n = nota?.trim().replace(/\.$/, '');
  return n ? `[Ato revogado: ${n}.] ` : '[Ato revogado.] ';
}

/** A mesma ressalva em SQL, seguida de quebra de linha; '' para ato vigente. */
export function ressalvaDeRevogacaoSql(alias: string): string {
  return `CASE WHEN ${alias}."revoked" THEN '[Ato revogado' || COALESCE(': ' || NULLIF(RTRIM(TRIM(${alias}."revokedNote"), '.'), ''), '') || '.]' || E'\\n' ELSE '' END`;
}
