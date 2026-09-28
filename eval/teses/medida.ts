/**
 * Medida pareada do deslocamento dos acórdãos pelas teses (spec §9).
 *
 * Pura: recebe as duas listas já ordenadas (sem e com o ramo das teses) e
 * compara. A execução contra o banco fica em `pareado.ts`.
 */

export interface ResultadoMedido {
  documentId: string
  sourceType: string
}

export interface Medida {
  query: string
  /** O que estava no top-N sem as teses e saiu dele com as teses. */
  deslocados: string[]
  /** Dos deslocados, os que o golden set anota como relevantes. */
  relevantesDeslocados: string[]
  /** Quantas teses entraram no top-N. */
  tesesNoTopN: number
  /** Teses entre as três primeiras posições: indicador de observação, não portão. */
  tesesNoTopo: number
  /** Posição média (1 = primeira) dos resultados que não são tese, sem e com o ramo. */
  posicaoMediaAntes: number
  posicaoMediaDepois: number
}

export const TOP = 5
const TOPO = 3

const media = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0)

/** Posições (1-based) dos resultados que não são tese, até o limite da lista. */
function posicoesSemTese(resultados: ResultadoMedido[]): number[] {
  return resultados.flatMap((r, i) => (r.sourceType === 'tese' ? [] : [i + 1]))
}

export function medirPar(
  query: string,
  sem: ResultadoMedido[],
  com: ResultadoMedido[],
  relevantes: string[] = [],
): Medida {
  const topSem = sem.slice(0, TOP).map((r) => r.documentId)
  const topCom = new Set(com.slice(0, TOP).map((r) => r.documentId))
  const deslocados = topSem.filter((id) => !topCom.has(id))
  const anotados = new Set(relevantes)

  return {
    query,
    deslocados,
    relevantesDeslocados: deslocados.filter((id) => anotados.has(id)),
    tesesNoTopN: com.slice(0, TOP).filter((r) => r.sourceType === 'tese').length,
    tesesNoTopo: com.slice(0, TOPO).filter((r) => r.sourceType === 'tese').length,
    posicaoMediaAntes: media(posicoesSemTese(sem)),
    posicaoMediaDepois: media(posicoesSemTese(com)),
  }
}

/** Quantas queries perderam 0, 1, 2… resultados do top-N. */
export function histograma(medidas: Medida[]): Record<number, number> {
  return medidas.reduce<Record<number, number>>((acc, m) => {
    acc[m.deslocados.length] = (acc[m.deslocados.length] ?? 0) + 1
    return acc
  }, {})
}

/** As queries que mais perderam, com desempate pelos relevantes perdidos. */
export function piores(medidas: Medida[], n = 3): Medida[] {
  return [...medidas]
    .sort(
      (a, b) =>
        b.deslocados.length - a.deslocados.length ||
        b.relevantesDeslocados.length - a.relevantesDeslocados.length,
    )
    .slice(0, n)
}
