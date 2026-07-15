/**
 * Divide o inteiro teor do acórdão em Relatório / Voto / Acórdão (dispositivo).
 *
 * A seção é o sinal que interessa: um princípio debatido no VOTO é razão de
 * decidir; o mesmo princípio só no RELATÓRIO é alegação da parte — que o
 * tribunal pode até ter rejeitado.
 *
 * O endpoint do TCU se chama SvlVisualizarRelVotoAcRtf: Relatório, Voto,
 * Acórdão. O documento já vem nessa ordem.
 */

export interface Secoes {
  /** [início, fim) no texto. */
  relatorio: [number, number] | null;
  voto: [number, number] | null;
  acordao: [number, number] | null;
}

/** Marcador de seção: em linha própria, em caixa alta. */
const RE_RELATORIO = /^\s*RELAT[ÓO]RIO\s*$/m;
const RE_VOTO = /^\s*VOTO\s*$/m;
const RE_ACORDAO = /^\s*AC[ÓO]RD[ÃA]O\s*$/gm;

export function seccionarAcordao(texto: string): Secoes | null {
  if (!texto) return null;

  const iRel = texto.search(RE_RELATORIO);
  const iVoto = texto.search(RE_VOTO);

  // Acórdãos curtos (multa, citação) só têm dispositivo — não é erro.
  if (iRel < 0 || iVoto < 0 || iVoto <= iRel) return null;

  // "ACÓRDÃO" também aparece no cabeçalho ("ACÓRDÃO Nº 1135/2026"). O
  // dispositivo é a última ocorrência isolada, e vem depois do voto.
  let iAc = -1;
  RE_ACORDAO.lastIndex = 0;
  for (const m of texto.matchAll(RE_ACORDAO)) {
    if (m.index !== undefined && m.index > iVoto) { iAc = m.index; break; }
  }

  const fim = texto.length;
  return {
    relatorio: [iRel, iVoto],
    voto: [iVoto, iAc > 0 ? iAc : fim],
    acordao: iAc > 0 ? [iAc, fim] : null,
  };
}

export function secaoDe(
  secoes: Secoes | null,
  pos: number
): 'relatorio' | 'voto' | 'acordao' | null {
  if (!secoes) return null;
  for (const nome of ['relatorio', 'voto', 'acordao'] as const) {
    const r = secoes[nome];
    if (r && pos >= r[0] && pos < r[1]) return nome;
  }
  return null; // cabeçalho, antes do relatório
}
