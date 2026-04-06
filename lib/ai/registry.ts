import { geminiProvider } from './providers/gemini'
import { anthropicProvider } from './providers/anthropic'
import type { AiProvider, AiProviderName, AiTask } from './types'

const PROVIDERS: Record<AiProviderName, AiProvider> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
}

interface TaskDefault {
  provider: AiProviderName
  model: string
}

/**
 * Defaults por tarefa. Sobrescritiveis via env vars.
 *
 * Esta fase preserva os modelos atualmente em uso no codigo (gemini-2.0-flash
 * em search/chat/extraction, claude-3-5-haiku para classificacao/sumarizacao,
 * claude-sonnet-4 para enhancement). Upgrades acontecem em fases posteriores.
 */
const DEFAULTS: Record<AiTask, TaskDefault> = {
  'search': { provider: 'gemini', model: 'gemini-2.0-flash' },
  'chat': { provider: 'gemini', model: 'gemini-2.0-flash' },
  'extraction': { provider: 'gemini', model: 'gemini-2.0-flash' },
  'classification': { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
  'summarization': { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
  'enhancement': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
}

const ENV_KEYS: Record<AiTask, { providerKey: string; modelKey: string }> = {
  'search': { providerKey: 'AI_SEARCH_PROVIDER', modelKey: 'AI_SEARCH_MODEL' },
  'chat': { providerKey: 'AI_CHAT_PROVIDER', modelKey: 'AI_CHAT_MODEL' },
  'extraction': { providerKey: 'AI_EXTRACTION_PROVIDER', modelKey: 'AI_EXTRACTION_MODEL' },
  'classification': { providerKey: 'AI_CLASSIFICATION_PROVIDER', modelKey: 'AI_CLASSIFICATION_MODEL' },
  'summarization': { providerKey: 'AI_SUMMARIZATION_PROVIDER', modelKey: 'AI_SUMMARIZATION_MODEL' },
  'enhancement': { providerKey: 'AI_ENHANCEMENT_PROVIDER', modelKey: 'AI_ENHANCEMENT_MODEL' },
}

export interface ResolvedTask {
  provider: AiProvider
  modelId: string
}

export function resolveTask(task: AiTask): ResolvedTask {
  const env = ENV_KEYS[task]
  const def = DEFAULTS[task]
  const providerName = (process.env[env.providerKey] || def.provider) as AiProviderName
  const modelId = process.env[env.modelKey] || def.model

  const provider = PROVIDERS[providerName]
  if (!provider) {
    throw new Error(
      `Unknown AI provider "${providerName}" for task "${task}". ` +
      `Valid providers: ${Object.keys(PROVIDERS).join(', ')}`
    )
  }

  return { provider, modelId }
}
