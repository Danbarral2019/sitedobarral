/**
 * Helpers para construir cache keys consistentes pra callers do lib/ai.
 */

/**
 * Hash determinÃ­stico (nÃ£o-criptogrÃ¡fico) de uma string. Usado pra construir
 * cache keys do Redis sem dependÃªncia de crypto SHA. ColisÃµes sÃ£o
 * teoricamente possÃ­veis mas estatisticamente irrelevantes pra cache
 * (~1 em bilhÃµes pra strings curtas).
 *
 * Determinismo: mesmo input -> mesmo output cross-runtime (Node/V8/Bun).
 * Use isso pra invalidar cache automaticamente quando o input mudar.
 *
 * Exemplo:
 *   const cacheKey = `claude:classify:${hashContent(prompt)}`
 */
export function hashContent(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
