/**
 * Regra de seleção: o que da extração do STF entra na base do site.
 *
 * Medido sobre o corpus de 16/08/2026 (2.467 ids únicos): a busca por expressão
 * alcança ementa, tese, legislação citada, indexação e ata, de modo que 986 dos
 * 1.410 julgados do recorte amplo mencionam licitação SÓ na legislação citada —
 * são de tema alheio. E 847 das 1.050 monocráticas são reclamações, que aplicam
 * precedente em vez de fixar tese, com texto ainda por cima truncado em 6.000
 * caracteres pelo índice.
 *
 * Números esperados com esta regra: 56 acórdãos + 437 do recorte amplo + 154
 * monocráticas = 598 documentos após dedup por id.
 */

import type { StfDecisaoNormalizada } from './types';

const RE_LICITACAO = /licita/i;

/**
 * Reclamação monocrática: alto volume, baixo valor jurisprudencial.
 * Comparação case-insensitive de propósito — fonte é externa e pode variar.
 */
const CLASSES_MONOCRATICAS_EXCLUIDAS = new Set(['RCL']);

export function ehRelevanteParaBase(d: StfDecisaoNormalizada): boolean {
  if (d.decisionType === 'acordao') {
    return d.citaLei14133 || RE_LICITACAO.test(d.ementa);
  }

  if (CLASSES_MONOCRATICAS_EXCLUIDAS.has(d.classe.trim().toUpperCase())) return false;
  return d.citaLei14133 && RE_LICITACAO.test(d.ementa);
}

export function selecionarRecorte(
  docs: StfDecisaoNormalizada[]
): StfDecisaoNormalizada[] {
  const vistos = new Set<string>();
  const saida: StfDecisaoNormalizada[] = [];

  for (const d of docs) {
    if (!ehRelevanteParaBase(d)) continue;
    if (vistos.has(d.sourceId)) continue;
    vistos.add(d.sourceId);
    saida.push(d);
  }

  return saida;
}
