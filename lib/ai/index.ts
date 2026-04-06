import { logger } from '@/lib/logger'
import { resolveTask } from './registry'
import { withRetry } from './retry'
import type { AiTask, AiGenerateRequest, AiGenerateResponse } from './types'

export type {
  AiTask,
  AiGenerateRequest,
  AiGenerateResponse,
  AiMessage,
  AiProvider,
  AiProviderName,
} from './types'

export { resolveTask } from './registry'
export { withRetry, isTransientError } from './retry'

/**
 * Ponto de entrada unico para chamadas a LLMs no projeto.
 *
 * - Resolve provider/modelo via env vars (AI_<TASK>_PROVIDER / AI_<TASK>_MODEL)
 *   ou defaults de registry.ts
 * - Aplica retry com backoff exponencial em erros transitorios (429, 5xx, rede)
 * - Loga via pino info/error com tokens, modelo, duracao
 *
 * NOTA: persistencia de auditoria em DB sera adicionada em fase posterior
 * (depende de criar modelo AuditLog no schema).
 *
 * Chamadores devem tratar excecoes — esta funcao re-lanca apos retries.
 */
export async function generate(
  task: AiTask,
  req: AiGenerateRequest
): Promise<AiGenerateResponse> {
  const { provider, modelId } = resolveTask(task)
  const start = Date.now()
  try {
    const result = await withRetry(() => provider.generate(modelId, req), {
      label: `ai.${task}`,
    })
    const durationMs = Date.now() - start

    logger.info(
      {
        task,
        provider: provider.name,
        modelId,
        durationMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        userId: req.userId,
      },
      'ai.generate.ok'
    )

    return result
  } catch (err) {
    const durationMs = Date.now() - start
    logger.error(
      { err, task, provider: provider.name, modelId, durationMs, userId: req.userId },
      'ai.generate.error'
    )
    throw err
  }
}
