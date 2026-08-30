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

/** Esfera declarada no bloco: `LEG-FED`, `LEG:EST`, `LEG-MUN`. */
const RE_ESFERA = /LEG[-:]([A-Z]{3})/i;

/** Ano declarado no bloco: `ANO-2021` / `ANO:2021`. */
const RE_ANO = /ANO[-:](\d{4})/i;

/**
 * `ART-00075` / `ART:00075` → `75`; `ART-00184-A` e `ART-0005A` → `184-A` e
 * `5-A`. Incisos não casam.
 *
 * O sufixo vem **colado** ao número na fonte do STF, não hifenizado: medido em
 * 30/08/2026, das 10 ocorrências de sufixo naquele corpus, 10 são `ART-0337L`
 * e nenhuma é `ART-00184-A`. Enquanto só o formato hifenizado era reconhecido,
 * `ART-0337L` virava artigo `337` e `ART-0005A` virava `5` — dispositivos que
 * existem na Lei 14.133 e não são os citados, logo um erro silencioso.
 *
 * O campo tem largura fixa de 5: cinco dígitos, ou quatro dígitos e uma letra.
 * Daí a alternância — `\d{5}` primeiro, senão até quatro dígitos e o sufixo.
 */
const RE_ARTIGO = /ART[-:](\d{5}|\d{1,4})-?([A-Z])?/gi;

function blocos(campo: string[] | string | null | undefined): string[] {
  if (campo === null || campo === undefined) return [];
  return (Array.isArray(campo) ? campo : [campo]).map(String);
}

/**
 * O bloco é da Lei 14.133/2021 — e não de uma homônima?
 *
 * O token do número sozinho não basta. Medido em 30/08/2026 sobre a fonte do
 * STF (1.071 julgados capturados), 13 eram de outra lei: 11 da Lei 14.113/2020
 * (FUNDEB) digitada como 14.133 e 2 da lei municipal 14.133/2006 de São Paulo.
 * Cinco já estavam no acervo, visíveis e com dispositivo amarrado.
 *
 * Note o que NÃO se faz aqui: exigir `ANO-2021`. Outros 9 julgados são a Lei
 * 14.133 de verdade com o ano errado na origem — em dois deles o próprio STF
 * escreveu "lei 14.133/2001" e "Lei nº 14.133/22" na ementa. Exigir o ano
 * derrubaria os 9 para eliminar os 13.
 *
 * Ver `docs/audits/2026-08-19-verificacao-material-stf.md`.
 */
function ehBlocoDa14133(bloco: string): boolean {
  if (!RE_TOKEN_LEI_14133.test(bloco)) return false;

  // A Lei 14.133 é federal por definição. Rejeita-se o que se declara
  // NÃO-federal, nunca a ausência de declaração: o STJ não persiste este campo
  // e não dá para medir lá, então a ausência fica aceita por conservadorismo.
  const esfera = RE_ESFERA.exec(bloco)?.[1]?.toUpperCase();
  if (esfera && esfera !== 'FED') return false;

  // 2020 é impossível para uma lei sancionada em 01/04/2021 — ali é sempre o
  // FUNDEB. Os demais anos divergentes são erro de digitação e ficam.
  if (RE_ANO.exec(bloco)?.[1] === '2020') return false;

  return true;
}

export function citaLei14133(campo: string[] | string | null | undefined): boolean {
  return blocos(campo).some(ehBlocoDa14133);
}

export function extrairArtigos14133(campo: string[] | string | null | undefined): string[] {
  const artigos = new Set<string>();

  for (const bloco of blocos(campo)) {
    if (!ehBlocoDa14133(bloco)) continue;

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
