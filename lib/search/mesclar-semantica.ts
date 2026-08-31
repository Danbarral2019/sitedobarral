/**
 * Mescla resultados semânticos na lista da busca textual.
 *
 * A busca pública era só full-text: casava palavra, não sentido. Quem digitava
 * "posso contratar sem licitação até quanto" não achava o art. 75, porque
 * nenhuma dessas palavras está no título dos documentos. Os 27.291 chunks de
 * embedding já indexados no pgvector só eram usados pela área logada.
 *
 * A ordem do full-text é preservada no topo: quando o termo casa literalmente,
 * é quase sempre o que a pessoa queria. A semântica entra atrás, cobrindo o
 * caso em que o full-text não achou nada de útil.
 */

export interface ComId {
  id: string;
}

/**
 * Junta as duas listas sem repetir e sem embaralhar o que veio do full-text.
 *
 * `limite` corta o total, não cada lista: numa busca com 20 acertos textuais
 * não faz sentido empurrar semântica para o fim de uma página que ninguém
 * rola.
 */
export function mesclarSemDuplicar<T extends ComId>(
  textuais: T[],
  semanticos: T[],
  limite: number,
): T[] {
  const vistos = new Set(textuais.map((d) => d.id));
  const extras = semanticos.filter((d) => !vistos.has(d.id));
  return [...textuais, ...extras].slice(0, limite);
}

/**
 * Quantos dos resultados semânticos são novos — o ganho real da semântica
 * naquela consulta. Serve para telemetria: se for sempre zero, a semântica não
 * está agregando e o custo do embedding não se justifica.
 */
export function contarNovos<T extends ComId>(textuais: T[], semanticos: T[]): number {
  const vistos = new Set(textuais.map((d) => d.id));
  return semanticos.filter((d) => !vistos.has(d.id)).length;
}
