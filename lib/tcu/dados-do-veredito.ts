/**
 * Os campos que um veredito conferido grava. Extraído para ser testável sem
 * banco: `herdadoDe: null` e `reconferenciaPendente: false` são o que
 * transforma um veredito provisório (spec §4.1, nível 2) em julgamento próprio.
 */
export function dadosDoVeredito(veredito: string, agora: Date, julgadoPor: string) {
  return { veredito, julgadoEm: agora, julgadoPor, herdadoDe: null, reconferenciaPendente: false };
}
