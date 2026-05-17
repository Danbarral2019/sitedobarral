/**
 * Cached Gemini Client (thin wrapper sobre `lib/ai`).
 *
 * Mantido por retrocompat — consumidores podem migrar diretamente para
 * `generate('chat', { provider: 'gemini', cache, fallbackModels,
 * safetySettings })` quando convier.
 *
 * Defaults aplicados automaticamente:
 *   - `provider: 'gemini'`
 *   - `safetySettings: LEGAL_SAFETY_SETTINGS` (preset juridico permissivo)
 *   - `fallbackModels: FALLBACK_GEMINI_MODELS` (deduplicado do model principal)
 *   - `cache: { key: CacheKeys.geminiQuery(...), ttl: cacheTTL }` quando `useCache` true (default)
 *   - `thinkingBudget: 0` (proteção LeiIndexer P0.1)
 *
 * @see lib/ai/index.ts — generate()
 * @see lib/ai/safety.ts — LEGAL_SAFETY_SETTINGS
 */

import { generate, LEGAL_SAFETY_SETTINGS } from '@/lib/ai'
import { CacheKeys, CACHE_TTL } from '../cache/redis-client'
import {
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODELS,
} from './config'

export interface GeminiQueryOptions {
  model?: string
  temperature?: number
  maxOutputTokens?: number
  useCache?: boolean
  cacheTTL?: number
  systemInstruction?: string
  /**
   * Controla o "thinking mode" dos modelos Gemini 2.5+ / 3.x.
   *
   * **Default agora e `0` (thinking desativado)** — Gemini consome ~1.500 tokens
   * em raciocinio interno antes do output visivel e, com `maxOutputTokens`
   * baixo, trunca JSON/texto silenciosamente. Esse default protege novos
   * call-sites do bug que sabotou o `LeiIndexer` por meses (auditoria
   * 2026-05-16, P0.1).
   *
   * Valores:
   *   - `0` (default): desativa thinking. Use para classificacao, extracao,
   *     resumo curto, parsing de JSON estruturado, expansao de queries.
   *   - `-1`: ativa dynamic thinking (modelo decide o budget). Use em chat
   *     conversacional e raciocinio multi-passo — ex.: chat artigos premium.
   *   - `N > 0`: budget fixo em tokens. Raro. Use so em experimentacao.
   */
  thinkingBudget?: number
}

export interface GeminiQueryResult {
  response: string
  cached: boolean
  latency: number
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
}

/**
 * Query Gemini com texto (cache opcional, fallback cascade automatico,
 * safety settings juridicos permissivos).
 */
export async function queryGeminiText(
  query: string,
  options: GeminiQueryOptions = {},
): Promise<GeminiQueryResult> {
  const {
    model = PRIMARY_GEMINI_MODEL,
    temperature = 0.7,
    maxOutputTokens = 2048,
    useCache = true,
    cacheTTL = CACHE_TTL.GEMINI_QUERY,
    systemInstruction,
    thinkingBudget = 0,
  } = options

  const startTime = Date.now()
  const cacheKey = CacheKeys.geminiQuery('text', query)

  const result = await generate('chat', {
    messages: [{ role: 'user', content: query }],
    provider: 'gemini',
    model,
    temperature,
    maxTokens: maxOutputTokens,
    ...(systemInstruction ? { systemPrompt: systemInstruction } : {}),
    thinkingBudget,
    safetySettings: LEGAL_SAFETY_SETTINGS,
    fallbackModels: [...FALLBACK_GEMINI_MODELS].filter((m) => m !== model),
    ...(useCache ? { cache: { key: cacheKey, ttl: cacheTTL } } : {}),
  })

  const latency = Date.now() - startTime
  return {
    response: result.text,
    // Mantem heuristica legacy: useCache + latency baixo = provavelmente cache HIT.
    // Util pra UI sinalizar fast-path; nao e garantia firme.
    cached: useCache && latency < 500,
    latency,
    tokens:
      result.inputTokens !== undefined
        ? {
            prompt: result.inputTokens,
            completion: result.outputTokens ?? 0,
            total: result.inputTokens + (result.outputTokens ?? 0),
          }
        : undefined,
  }
}

const geminiClient = {
  queryGeminiText,
}
export default geminiClient
