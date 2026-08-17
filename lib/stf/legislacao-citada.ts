/**
 * Extração dos dispositivos da Lei 14.133/2021 citados num julgado do STF.
 *
 * O campo `documental_legislacao_citada_texto` da API do STF traz um bloco de
 * texto por norma citada, no formato:
 *
 *     LEG-FED   LEI-014133 ANO-2021
 *         ART-00075 INC-00002
 *         LEI ORDINÁRIA
 *
 * Como cada norma vive em seu próprio bloco, filtrar o bloco pelo token da lei
 * e só então extrair os `ART-` dá amarração artigo↔julgado DETERMINÍSTICA —
 * sem heurística de proximidade e sem LLM. É a razão principal deste conector.
 */

const TOKEN_LEI_14133 = 'LEI-014133';

/** `ART-00075` → `75`; `ART-00184-A` → `184-A`. Incisos (`INC-`) não casam. */
const RE_ARTIGO = /ART-(\d{1,5})(?:-([A-Z]))?/g;

function blocos(campo: string[] | string | null | undefined): string[] {
  if (campo === null || campo === undefined) return [];
  return (Array.isArray(campo) ? campo : [campo]).map(String);
}

export function citaLei14133(campo: string[] | string | null | undefined): boolean {
  return blocos(campo).some(b => b.includes(TOKEN_LEI_14133));
}

export function extrairArtigos14133(campo: string[] | string | null | undefined): string[] {
  const artigos = new Set<string>();

  for (const bloco of blocos(campo)) {
    if (!bloco.includes(TOKEN_LEI_14133)) continue;

    RE_ARTIGO.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_ARTIGO.exec(bloco)) !== null) {
      const numero = m[1].replace(/^0+/, '') || '0';
      artigos.add(m[2] ? `${numero}-${m[2]}` : numero);
    }
  }

  return Array.from(artigos).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    return na !== nb ? na - nb : a.localeCompare(b);
  });
}
