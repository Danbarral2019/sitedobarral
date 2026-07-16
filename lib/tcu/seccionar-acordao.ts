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

/**
 * Marcador de seção: em linha própria, em caixa alta.
 *
 * O dispositivo real do TCU NUNCA é a palavra isolada "ACÓRDÃO" — vem
 * sempre com número e colegiado na mesma linha, ex.:
 * "ACÓRDÃO Nº 1135/2026 – TCU – Plenário" (o travessão é en dash "–", não
 * hífen). Por isso o "Nº" (e variantes "N°"/"No"/"NO") depois de
 * AC[ÓO]RD[ÃA]O é OBRIGATÓRIO, não opcional — uma linha "ACÓRDÃO" solta
 * não é o dispositivo e não deve casar. A âncora de linha inteira (^...$)
 * continua obrigatória: uma citação no meio do voto ("Conforme o Acórdão
 * 1.211/2021-TCU-Plenário, decido.") tem prefixo antes de "ACÓRDÃO" e não
 * casa.
 */
const RE_RELATORIO = /^\s*RELAT[ÓO]RIO\s*$/m;
const RE_VOTO = /^\s*VOTO\s*$/m;
const RE_ACORDAO = /^\s*AC[ÓO]RD[ÃA]O\s+N[º°oO].*$/gm;

export function seccionarAcordao(texto: string): Secoes | null {
  if (!texto) return null;

  const iRel = texto.search(RE_RELATORIO);
  const iVoto = texto.search(RE_VOTO);

  // Acórdãos curtos (multa, citação) só têm dispositivo — não é erro.
  if (iRel < 0 || iVoto < 0 || iVoto <= iRel) return null;

  // Um voto pode citar/transcrever outro acórdão em bloco próprio; o
  // dispositivo de fato é sempre o ÚLTIMO bloco "ACÓRDÃO Nº ..." do
  // texto — por isso percorremos todas as ocorrências após o voto e
  // ficamos com a última, não a primeira.
  let iAc = -1;
  RE_ACORDAO.lastIndex = 0;
  for (const m of texto.matchAll(RE_ACORDAO)) {
    if (m.index !== undefined && m.index > iVoto) { iAc = m.index; }
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
