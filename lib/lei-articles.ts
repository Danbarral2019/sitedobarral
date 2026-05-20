/**
 * Helpers canônicos para leitura/escrita do campo `leiArticles` em registros
 * Prisma (Document, BlogPost, Publication, GlossaryTerm, LegislativeAct,
 * Lesson, TribunalDecision).
 *
 * Pós-Onda 4.5.6 (drop coluna JSON-string legada):
 *   - `leiArticlesArr: String[]` é o único storage no banco
 *   - `setLeiArticles(arr)` escreve apenas em `leiArticlesArr`
 *   - `getLeiArticles(record)` lê apenas de `leiArticlesArr` (sem fallback)
 *
 * `parseLeiArticles(value)` e `stringifyLeiArticles(arr)` continuam exportados
 * porque outros consumidores fora de records Prisma os usam (form upload,
 * raw SQL com snake_case, payloads de wire serializados, scripts CLI legados).
 */

type LeiArticlesRecord = {
  // Pós-4.5.6 só existe `leiArticlesArr` no schema do Prisma. Mas tipos client/wire
  // ainda usam o nome legado `leiArticles` (JSON-string ou array já parseado) — o
  // helper aceita ambos para conviver com payloads de API e form data.
  leiArticlesArr?: string[] | null
  leiArticles?: string | string[] | null
}

/**
 * Parser canônico: aceita JSON `'["75","18"]'`, CSV `'75,18'`, array já
 * parseado ou null/undefined. Sempre retorna `string[]`.
 *
 * Mantido pós-4.5.6 para serializações wire/legacy (uploads, raw SQL etc.).
 */
export function parseLeiArticles(
  value: string | null | undefined | unknown,
): string[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map(String)
  }

  if (typeof value !== 'string') return []

  const trimmed = value.trim()
  if (trimmed === '') return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter((s) => s.length > 0)
    }
    return []
  } catch {
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
}

/**
 * Writer canônico de string JSON (wire format). Mantido pós-4.5.6 para
 * APIs/scripts que serializam o array em texto.
 */
export function stringifyLeiArticles(arr: string[]): string {
  return JSON.stringify(arr.map(String))
}

/**
 * Lê o campo lei-articles de um record Prisma ou de um payload com nome legado.
 * Prefere `leiArticlesArr` (canônico pós-4.5.6) e cai pra `leiArticles` quando
 * presente (cobre tipos client locais que ainda usam o nome antigo).
 */
export function getLeiArticles<T extends LeiArticlesRecord>(record: T): string[] {
  const arr = record.leiArticlesArr
  if (Array.isArray(arr)) return arr.map(String)
  return parseLeiArticles(record.leiArticles)
}

/**
 * Produz o objeto `data` pra Prisma create/update do campo lei-articles.
 *
 * Pós-4.5.6: escreve apenas `leiArticlesArr`. A coluna legada `leiArticles`
 * foi dropada do schema.
 *
 * @example
 * ```ts
 * await prisma.document.update({
 *   where: { id },
 *   data: { ...setLeiArticles(['75', '18']) },
 * })
 * ```
 */
export function setLeiArticles(
  arr: string[] | null | undefined,
): { leiArticlesArr: string[] } {
  if (arr === null || arr === undefined) {
    return { leiArticlesArr: [] }
  }
  return { leiArticlesArr: arr.map(String) }
}
