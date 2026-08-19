/**
 * Extração dos dispositivos da Lei 14.133/2021 citados num julgado.
 *
 * Dois tribunais publicam legislação citada em campo estruturado, no mesmo
 * desenho e com separadores diferentes:
 *
 *   STF (documental_legislacao_citada_texto)   LEG-FED LEI-014133 ANO-2021
 *                                                  ART-00075 INC-00002
 *   STJ (referenciasLegislativas)              LEG:FED LEI:014133 ANO:2021
 *                                                  ART:00075
 *
 * Como cada norma vive em seu próprio bloco, filtrar o bloco pelo token da lei
 * e só então extrair os artigos dá amarração artigo↔julgado DETERMINÍSTICA —
 * sem heurística de proximidade e sem LLM. É a razão principal destes conectores.
 *
 * Comparação case-insensitive de propósito, pela mesma razão do `recorte.ts`
 * do STF: a fonte é externa e pode variar de caixa. As duas regex usam a
 * flag `i` — se só o token da lei fosse case-insensitive, um bloco em
 * minúsculas faria `citaLei14133()` devolver `true` e `extrairArtigos14133()`
 * devolver `[]`, o que quebraria a auto-aprovação de julgados a jusante.
 */

/** Aceita `LEI-014133` e `LEI:014133`, com ou sem zeros à esquerda. */
const RE_TOKEN_LEI_14133 = /LEI[-:]0*14133\b/i;

/** `ART-00075` / `ART:00075` → `75`; `ART-00184-A` → `184-A`. Incisos não casam. */
const RE_ARTIGO = /ART[-:](\d{1,5})(?:-([A-Z]))?/gi;

function blocos(campo: string[] | string | null | undefined): string[] {
  if (campo === null || campo === undefined) return [];
  return (Array.isArray(campo) ? campo : [campo]).map(String);
}

export function citaLei14133(campo: string[] | string | null | undefined): boolean {
  return blocos(campo).some((b) => RE_TOKEN_LEI_14133.test(b));
}

export function extrairArtigos14133(campo: string[] | string | null | undefined): string[] {
  const artigos = new Set<string>();

  for (const bloco of blocos(campo)) {
    if (!RE_TOKEN_LEI_14133.test(bloco)) continue;

    RE_ARTIGO.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_ARTIGO.exec(bloco)) !== null) {
      const numero = m[1].replace(/^0+/, '') || '0';
      // Normaliza o sufixo para maiúscula no ponto de escrita: a flag `i` da
      // regex também casa `art-00184-a`, e "184-a" não amarraria com o
      // "184-A" já gravado no banco.
      artigos.add(m[2] ? `${numero}-${m[2].toUpperCase()}` : numero);
    }
  }

  return Array.from(artigos).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    return na !== nb ? na - nb : a.localeCompare(b);
  });
}
