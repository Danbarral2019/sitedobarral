import type { GoldenAnnotations } from '../../types'
import type { AnnotationList } from './types'

/**
 * Retorna uma nova GoldenAnnotations com `id` adicionado em `relevant`
 * (sempre) e em `highlyRelevant` (se list === 'highly'). Sem duplicatas.
 * Não muta input.
 */
export function addToAnnotations(
  ann: GoldenAnnotations,
  id: string,
  list: AnnotationList
): GoldenAnnotations {
  const relevant = ann.relevant.includes(id) ? ann.relevant : [...ann.relevant, id]
  const highlyRelevant =
    list === 'highly' && !ann.highlyRelevant.includes(id)
      ? [...ann.highlyRelevant, id]
      : ann.highlyRelevant
  return { ...ann, relevant, highlyRelevant }
}

/**
 * Retorna uma nova GoldenAnnotations com `id` removido de ambos arrays.
 * Não muta input.
 */
export function removeFromAnnotations(
  ann: GoldenAnnotations,
  id: string
): GoldenAnnotations {
  return {
    ...ann,
    relevant: ann.relevant.filter((x) => x !== id),
    highlyRelevant: ann.highlyRelevant.filter((x) => x !== id),
  }
}
