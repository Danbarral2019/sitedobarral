import { logger } from '@/lib/logger'
import { withCache } from '@/lib/cache/redis-client'
import { resolveTask } from './registry'
import { withRetry } from './retry'
import { shouldTryFallbackModel } from './error-detection'
import type {
  AiTask,
  AiGenerateRequest,
  AiGenerateResponse,
  AiStreamChunk,
  AiProvider,
} from './types'

export type {
  AiTask,
  AiGenerateRequest,
  AiGenerateResponse,
  AiMessage,
  AiProvider,
  AiProviderName,
  AiStreamChunk,
  AiCacheOptions,
  GeminiSafetySetting,
} from './types'

export { resolveTask } from './registry'
export { withRetry, isTransientError } from './retry'
export {
  isRateLimitError,
  isModelAvailabilityError,
  shouldTryFallbackModel,
} from './error-detection'
export { LEGAL_SAFETY_SETTINGS } from './safety'
export { hashContent } from './cache-key'

/**
 * Tenta executar `fn(modelId)` no modelo principal e, em caso de falha
 * recuperavel por cascade (model not found / deprecated / 429 quota),
 * cascateia pelos `fallbackModels` em ordem. Outros erros (safety, auth,
 * rede) propagam imediatamente.
 */
async function runWithFallback<T>(
  primaryModel: string,
  fallbacks: string[] | undefined,
  fn: (modelId: string) => Promise<T>,
  task: AiTask,
): Promise<T> {
  const tryOrder = [
    primaryModel,
    ...(fallbacks ?? []).filter((m) => m !== primaryModel),
  ]
  let lastErr: unknown
  for (let i = 0; i < tryOrder.length; i++) {
    const m = tryOrder[i]
    try {
      const result = await fn(m)
      if (i > 0) {
        logger.warn(
          { task, primary: primaryModel, succeeded: m },
          'ai.fallback.succeeded',
        )
      }
      return result
    } catch (err) {
      lastErr = err
      const isLast = i === tryOrder.length - 1
      if (isLast || !shouldTryFallbackModel(err)) {
        throw err
      }
      logger.warn(
        { task, failed: m, next: tryOrder[i + 1], err },
        'ai.fallback.trying-next',
      )
    }
  }
  throw lastErr ?? new Error('All fallback models failed')
}

function resolve(task: AiTask, req: AiGenerateRequest): { provider: AiProvider; modelId: string } {
  return resolveTask(task, { provider: req.provider, model: req.model })
}

/**
 * Ponto de entrada unico para chamadas a LLMs no projeto.
 *
 * - Resolve provider/modelo via env vars (AI_<TASK>_PROVIDER / AI_<TASK>_MODEL)
 *   ou defaults de registry.ts; aceita override per-call via req.provider/req.model
 * - Aplica retry com backoff exponencial em erros transitorios (429, 5xx, rede)
 * - Cascade entre modelos via req.fallbackModels (quando modelo deprecado/404/quota)
 * - Cache opt-in via req.cache ({ key, ttl }) — Redis
 * - Loga via pino info/error com tokens, modelo, duracao
 *
 * Chamadores devem tratar excecoes — esta funcao re-lanca apos retries + cascade.
 */
export async function generate(
  task: AiTask,
  req: AiGenerateRequest,
): Promise<AiGenerateResponse> {
  const { provider, modelId } = resolve(task, req)
  const start = Date.now()

  const exec = async (): Promise<AiGenerateResponse> => {
    return runWithFallback(
      modelId,
      req.fallbackModels,
      (m) => withRetry(() => provider.generate(m, req), { label: `ai.${task}` }),
      task,
    )
  }

  try {
    const result = req.cache
      ? await withCache(req.cache.key, exec, req.cache.ttl)
      : await exec()

    const durationMs = Date.now() - start
    logger.info(
      {
        task,
        provider: result.provider,
        modelId: result.modelId,
        durationMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cached: req.cache !== undefined && durationMs < 500,
        userId: req.userId,
      },
      'ai.generate.ok',
    )

    return result
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error(
      { err, task, provider: provider.name, modelId, durationMs, userId: req.userId },
      'ai.generate.error',
    )
    throw err
  }
}

/**
 * Versao streaming de generate(). Retorna AsyncIterable<AiStreamChunk>.
 *
 * - Cascade entre modelos aplica-se apenas a falhas na INICIACAO do stream
 *   (antes do primeiro chunk). Falhas mid-stream propagam ao consumer.
 * - req.cache e IGNORADO (streams nao sao facilmente re-emissoes).
 * - Retry transient (429/5xx) ainda funciona na iniciacao.
 *
 * Provider sem suporte a streaming lanca erro.
 */
export async function generateStream(
  task: AiTask,
  req: AiGenerateRequest,
): Promise<AsyncIterable<AiStreamChunk>> {
  const { provider, modelId } = resolve(task, req)
  if (!provider.generateStream) {
    throw new Error(`Provider "${provider.name}" does not support streaming`)
  }
  const start = Date.now()

  try {
    const stream = await runWithFallback(
      modelId,
      req.fallbackModels,
      (m) =>
        withRetry(() => provider.generateStream!(m, req), { label: `ai.${task}.stream` }),
      task,
    )

    const durationMs = Date.now() - start
    logger.info(
      { task, provider: provider.name, modelId, durationMs, userId: req.userId },
      'ai.generateStream.ok',
    )
    return stream
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error(
      { err, task, provider: provider.name, modelId, durationMs, userId: req.userId },
      'ai.generateStream.error',
    )
    throw err
  }
}
