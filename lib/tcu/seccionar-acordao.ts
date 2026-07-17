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
const RE_VOTO = /^\s*VOTO\s*$/gm;
const RE_ACORDAO = /^\s*AC[ÓO]RD[ÃA]O\s+N[º°oO].*$/gm;

/** Última ocorrência de `re` (global) dentro de (min, max]; -1 se nenhuma. */
function ultimaEntre(texto: string, re: RegExp, min: number, max: number): number {
  let achado = -1;
  re.lastIndex = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index !== undefined && m.index > min && (max < 0 || m.index < max)) {
      achado = m.index;
    }
  }
  return achado;
}

export function seccionarAcordao(texto: string): Secoes | null {
  if (!texto) return null;

  const iRel = texto.search(RE_RELATORIO);
  if (iRel < 0) return null;

  // O dispositivo é sempre o ÚLTIMO bloco "ACÓRDÃO Nº ..." do texto — em
  // pedidos de reexame, a decisão anterior é transcrita inteira (com seu
  // próprio "ACÓRDÃO Nº"), mas ela fica no relatório, antes do dispositivo
  // real. Achá-lo PRIMEIRO permite depois delimitar o voto por ele.
  const iAc = ultimaEntre(texto, RE_ACORDAO, iRel, -1);

  // O voto real é o ÚLTIMO "VOTO" entre o relatório e o dispositivo, NÃO o
  // primeiro. O TCU transcreve a decisão recorrida dentro do relatório —
  // inclusive a linha "VOTO" daquela decisão. Pegar o primeiro rotularia
  // trecho do relatório como voto e inflaria forte.voto (o sinal central).
  const iVoto = ultimaEntre(texto, RE_VOTO, iRel, iAc);

  // Acórdãos curtos (multa, citação) só têm dispositivo — não é erro.
  if (iVoto < 0) return null;

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
