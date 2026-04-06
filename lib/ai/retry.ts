import { logger } from '@/lib/logger'

export interface RetryOptions {
  /** Numero maximo de tentativas (incluindo a primeira). Default 3. */
  maxAttempts?: number
  /** Atraso inicial em ms. Default 500. */
  initialDelayMs?: number
  /** Multiplicador exponencial. Default 2. */
  factor?: number
  /** Atraso maximo em ms. Default 8000. */
  maxDelayMs?: number
  /** Etiqueta para logs. */
  label?: string
}

/**
 * Identifica erros transitorios que valem retry: 429 (rate limit),
 * 500/502/503/504 (server side), erros de rede.
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  if (/\b(429|500|502|503|504)\b/.test(msg)) return true
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up/i.test(msg)) return true
  // Anthropic SDK e Gemini lancam objetos com .status
  const status = (err as { status?: number }).status
  if (status && (status === 429 || (status >= 500 && status < 600))) return true
  return false
}

/**
 * Executa fn com backoff exponencial em erros transitorios.
 * Para erros nao-transitorios (4xx exceto 429), falha imediatamente.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3
  const initialDelay = opts.initialDelayMs ?? 500
  const factor = opts.factor ?? 2
  const maxDelay = opts.maxDelayMs ?? 8000
  const label = opts.label ?? 'retry'

  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === maxAttempts || !isTransientError(err)) {
        throw err
      }
      const delay = Math.min(maxDelay, initialDelay * Math.pow(factor, attempt - 1))
      // jitter +- 25%
      const jittered = delay * (0.75 + Math.random() * 0.5)
      logger.warn({ label, attempt, nextDelayMs: Math.round(jittered), err: (err as Error).message }, 'ai.retry')
      await new Promise((r) => setTimeout(r, jittered))
    }
  }
  throw lastErr
}
