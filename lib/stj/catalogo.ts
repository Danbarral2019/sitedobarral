/**
 * Descoberta dos dumps mensais de um dataset de espelhos.
 *
 * A API CKAN do STJ é irregular: `package_show` é rejeitada pelo WAF,
 * `package_search?q=name:<slug>` passa. Há teste travando essa escolha.
 */

import { BASE_DADOS_ABERTOS_STJ } from './constantes';
import { baixar } from './consulta';

export interface DumpMensal {
  /** Ex.: "20260630.json" — o nome carrega a competência do dump. */
  nome: string;
  url: string;
}

export async function listarDumps(slug: string): Promise<DumpMensal[]> {
  const url = `${BASE_DADOS_ABERTOS_STJ}/api/3/action/package_search?q=name:${slug}&rows=1`;
  const corpo = await baixar(url);
  const dados = JSON.parse(corpo) as {
    result?: { results?: Array<{ resources?: Array<Record<string, unknown>> }> };
  };

  const pacote = dados.result?.results?.[0];
  if (!pacote) return [];

  return (pacote.resources ?? [])
    .filter((r) => String(r.format).toUpperCase() === 'JSON')
    .map((r) => ({ nome: String(r.name), url: String(r.url) }))
    .sort((a, b) => b.nome.localeCompare(a.nome));
}
