/**
 * Helpers canônicos para leitura/escrita do campo `leiArticles` em registros
 * Prisma (Document, BlogPost, Publication, GlossaryTerm, LegislativeAct,
 * Lesson, TribunalDecision).
 *
 * Foundation pra Onda 4.5 — migração JSON-string → Postgres `String[]`.
 *
 * - `parseLeiArticles(value)`: parser canônico (substitui safeParseArray +
 *   JSON.parse pra esse campo). Aceita JSON `'["75","18"]'`, CSV `'75,18'`,
 *   array já parseado, null/undefined. Sempre retorna `string[]`.
 *
 * - `stringifyLeiArticles(arr)`: writer canônico (substitui JSON.stringify
 *   inline). Garante shape consistente.
 *
 * - `getLeiArticles(record)`: lê o campo de um record Prisma. Hoje delega
 *   para parseLeiArticles do campo `leiArticles`. Pós-PR 4.5.4 vai preferir
 *   `leiArticlesArr` (Postgres native array) com fallback pro JSON-string.
 *
 * - `setLeiArticles(arr)`: produz o objeto `data` pra Prisma create/update.
 *   Hoje retorna apenas `{ leiArticles: JSON.stringify(arr) }`. Pós-PR
 *   4.5.3 dual-write retornará `{ leiArticles, leiArticlesArr }`. Pós-PR
 *   4.5.5 retornará apenas `{ leiArticlesArr }`. Migrar agora pro helper
 *   permite que essas mudanças sejam 1-liner.
 *
 * Veja `docs/plans/2026-05-saneamento.md` (Onda 4.5) ou o memory
 * `project_plano_saneamento.md` pra plano completo.
 */

type LeiArticlesRecord = {
  leiArticles?: string | null
}

/**
 * Parser canônico do campo `leiArticles`.
 *
 * Aceita:
 *   - JSON array string: `'["75","18"]'` → `["75","18"]`
 *   - JSON com números: `'[75,18]'` → `["75","18"]` (coerce para string)
 *   - CSV: `'75,18'` → `["75","18"]` (fallback quando JSON.parse falha)
 *   - Array já parseado: `["75"]` → `["75"]`
 *   - null/undefined/'' → `[]`
 *
 * Sempre retorna `string[]` válido.
 */
export function parseLeiArticles(
  value: string | null | undefined | unknown,
): string[] {
  if (!value) return []

  // Array já parseado — normaliza para string[]
  if (Array.isArray(value)) {
    return value.map(String)
  }

  if (typeof value !== 'string') return []

  const trimmed = value.trim()
  if (trimmed === '') return []

  // Tenta JSON primeiro (caso esperado em 99%+ dos casos)
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter((s) => s.length > 0)
    }
    // JSON válido mas não é array (ex: '"75"', 'null', '{}') — não vale CSV
    return []
  } catch {
    // JSON falhou — fallback CSV pra dados legados (legacy import de blog/manual)
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
}

/**
 * Writer canônico — produz o JSON-string que vai pro banco.
 *
 * Garante shape consistente: sempre `string`, nunca `null` (use o helper
 * `setLeiArticles` quando precisar de null pra "limpar" o campo).
 */
export function stringifyLeiArticles(arr: string[]): string {
  return JSON.stringify(arr.map(String))
}

/**
 * Lê o campo `leiArticles` de um record Prisma. Wrapper sobre `parseLeiArticles`
 * que facilita migração futura pra `leiArticlesArr` (Postgres array).
 *
 * Pós-PR 4.5.4, esta função vai preferir `record.leiArticlesArr` quando
 * disponível, com fallback pro `record.leiArticles` (JSON string).
 */
export function getLeiArticles<T extends LeiArticlesRecord>(record: T): string[] {
  return parseLeiArticles(record.leiArticles)
}

/**
 * Produz o objeto `data` pra Prisma create/update do campo leiArticles.
 *
 * Hoje: `{ leiArticles: JSON.stringify(arr) }`
 * Pós-PR 4.5.3 dual-write: `{ leiArticles, leiArticlesArr }`
 * Pós-PR 4.5.5: `{ leiArticlesArr }` (drop coluna antiga em 4.5.6)
 *
 * Semântica preservada do pattern dominante `arr ? JSON.stringify(arr) : null`:
 *   - `null`/`undefined` → `{ leiArticles: null }` (limpa campo)
 *   - `[]` (array vazio) → `{ leiArticles: '[]' }` (preserva JSON array string)
 *   - `['75']` → `{ leiArticles: '["75"]' }`
 *
 * Decisão sobre `[]`: callers existentes que passam `[] ? JSON.stringify([]) : null`
 * gravam `'[]'` (porque `[]` é truthy em JS). Helper preserva esse comportamento
 * pra não mudar valores na coluna sob queries existentes (`WHERE leiArticles IS NULL`
 * vs `WHERE leiArticles = '[]'`). Pra limpar de fato, passe `null`.
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
): { leiArticles: string | null } {
  if (arr === null || arr === undefined) {
    return { leiArticles: null }
  }
  return { leiArticles: stringifyLeiArticles(arr) }
}
