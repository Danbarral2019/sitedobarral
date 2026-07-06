import { geminiProvider } from './providers/gemini'
import { anthropicProvider } from './providers/anthropic'
import { PRIMARY_GEMINI_MODEL } from '../gemini/config'
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
 * search/chat/extraction usam PRIMARY_GEMINI_MODEL (hoje `gemini-2.5-flash`,
 * ver lib/gemini/config.ts). Migracao feita pelo ROADMAP_GEMINI_MODELO_25.md
 * em 2026-04-22.
 *
 * Anthropic: claude-haiku-4-5 para classificacao/sumarizacao,
 * claude-sonnet-5 para enhancement (Fase 2.3: claude-sonnet-4-20250514 foi
 * APOSENTADO em 15/06/2026 e retornava 404).
 */
const DEFAULTS: Record<AiTask, TaskDefault> = {
  'search': { provider: 'gemini', model: PRIMARY_GEMINI_MODEL },
  'chat': { provider: 'gemini', model: PRIMARY_GEMINI_MODEL },
  'extraction': { provider: 'gemini', model: PRIMARY_GEMINI_MODEL },
  'classification': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  'summarization': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  'enhancement': { provider: 'anthropic', model: 'claude-sonnet-5' },
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

export interface ResolveTaskOverride {
  provider?: AiProviderName
  model?: string
}

/**
 * Resolve task -> { provider, modelId }. Ordem de precedencia:
 * 1. `override` (per-call) — vence sobre tudo
 * 2. env vars `AI_<TASK>_PROVIDER` / `AI_<TASK>_MODEL`
 * 3. defaults do registry (DEFAULTS)
 */
export function resolveTask(task: AiTask, override?: ResolveTaskOverride): ResolvedTask {
  const env = ENV_KEYS[task]
  const def = DEFAULTS[task]
  const providerName = (override?.provider || process.env[env.providerKey] || def.provider) as AiProviderName
  const modelId = override?.model || process.env[env.modelKey] || def.model

  const provider = PROVIDERS[providerName]
  if (!provider) {
    throw new Error(
      `Unknown AI provider "${providerName}" for task "${task}". ` +
      `Valid providers: ${Object.keys(PROVIDERS).join(', ')}`
    )
  }

  return { provider, modelId }
}
