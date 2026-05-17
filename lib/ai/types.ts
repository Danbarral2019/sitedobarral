/**
 * Camada de abstracao de provedores de LLM.
 *
 * Permite trocar o modelo/provedor de cada tarefa via env vars
 * (AI_<TASK>_PROVIDER, AI_<TASK>_MODEL) sem mexer no codigo dos chamadores.
 *
 * Suporta:
 *   - generate(task, req) — chamada simples (texto in / texto out)
 *   - generateStream(task, req) — streaming via AsyncIterable
 *   - cache opt-in via Redis (`req.cache`)
 *   - fallback cascade entre modelos (`req.fallbackModels`)
 *   - safetySettings (Gemini-only; ignorado por Anthropic)
 *   - responseSchema (Gemini structured output)
 *   - override per-call de provider/model
 */

export type AiTask =
  | 'search'
  | 'chat'
  | 'extraction'
  | 'classification'
  | 'summarization'
  | 'enhancement'

export type AiProviderName = 'gemini' | 'anthropic'

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Cache opt-in. Quando presente, `generate()` envolve a chamada em
 * `withCache(key, fn, ttl)` de `lib/cache/redis-client`. Chamadas
 * idempotenticas com mesma `key` retornam resultado em cache.
 *
 * NAO se aplica a streaming (AsyncIterable nao pode ser facilmente
 * re-emitido) — `generateStream()` ignora `req.cache`.
 */
export interface AiCacheOptions {
  /** Chave Redis unica. Recomendado: hash do conteudo (prompt + opcoes). */
  key: string
  /** TTL em segundos. */
  ttl: number
}

/**
 * Safety settings do Gemini (`HARM_CATEGORY_*` + `HarmBlockThreshold.*`).
 * Tipo deliberadamente solto pra evitar acoplamento de tipo com a SDK
 * `@google/genai`. Callers podem usar strings literais ou os enums da SDK.
 *
 * Anthropic IGNORA este campo (nao tem equivalente — usa
 * trust & safety embarcado no modelo).
 *
 * Use `LEGAL_SAFETY_SETTINGS` de `@/lib/ai/safety` para o preset
 * permissivo padronizado deste projeto (contexto juridico).
 */
export interface GeminiSafetySetting {
  category: string
  threshold: string
}

export interface AiGenerateRequest {
  /** Prompt de sistema (instrucoes globais). */
  systemPrompt?: string
  /** Historico de mensagens. Para tarefas single-turn, passar [{ role: 'user', content }]. */
  messages: AiMessage[]
  /** 0..1, default 0.3. */
  temperature?: number
  /** Default 4096. */
  maxTokens?: number
  /** Se true, instrui o modelo a retornar JSON puro. */
  jsonMode?: boolean
  /**
   * Gemini structured output schema (JSON Schema simplificado da SDK
   * `@google/genai`). Quando presente, o Gemini valida a resposta contra o
   * schema e garante JSON tipado. Ignorado pelo provider Anthropic (que cobre
   * structured output via `jsonMode` + prompting).
   */
  responseSchema?: unknown
  /**
   * Gemini 2.5 only. Desativa (0) ou limita o "thinking mode". Passe 0 para
   * tarefas curtas (resumo / classificacao); senao o thinking pode consumir
   * ~95% do maxTokens e truncar a resposta. Ignorado pelo provider Anthropic.
   */
  thinkingBudget?: number
  /**
   * Safety settings do Gemini. Ignorado pelo Anthropic. Use o preset
   * `LEGAL_SAFETY_SETTINGS` de `@/lib/ai/safety` para o caso juridico.
   */
  safetySettings?: GeminiSafetySetting[]
  /**
   * Override de provider por chamada. Quando ausente, usa `AI_<TASK>_PROVIDER`
   * env ou default do registry. Util para casos onde uma mesma `task` precisa
   * rodar em providers diferentes (ex.: dois classifiers distintos).
   */
  provider?: AiProviderName
  /**
   * Override de modelo por chamada. Quando ausente, usa `AI_<TASK>_MODEL` env
   * ou default do registry. Util para scripts comparativos (premium vs flash)
   * sem mexer em env global.
   */
  model?: string
  /**
   * Lista ordenada de modelos de fallback. Se o modelo principal falhar com
   * erro recuperavel por cascade (404 model not found, model deprecated, 429
   * rate-limit), tenta proximo em ordem. Erros nao-recuperaveis (safety,
   * auth, network) NAO disparam fallback — propagam direto.
   *
   * Aplica-se tambem a `generateStream()`, mas apenas se a falha ocorrer na
   * INICIACAO do stream (antes do primeiro chunk). Falhas mid-stream nao
   * cascateiam — mesma limitacao do `lib/gemini/cached-client` legacy.
   */
  fallbackModels?: string[]
  /**
   * Cache opt-in. Aplica-se apenas a `generate()` (nao streaming).
   * Ver `AiCacheOptions`.
   */
  cache?: AiCacheOptions
  /** Opcional: usuario que disparou a chamada (uso futuro p/ auditoria). */
  userId?: string
}

export interface AiGenerateResponse {
  text: string
  inputTokens?: number
  outputTokens?: number
  /** Provider e modelo efetivamente usados — util para auditoria/billing. */
  provider: AiProviderName
  modelId: string
}

/**
 * Chunk de streaming. Cada chunk pode trazer texto incremental
 * (`text`), ou metadata terminal (`finishReason` + `usage`), ou ambos.
 *
 * Conventional shape:
 *   - chunks intermediarios: `{ text: '...', provider, modelId }`
 *   - chunk final: `{ finishReason, usage, provider, modelId }`
 *   (alguns providers emitem text + finishReason no mesmo ultimo chunk)
 */
export interface AiStreamChunk {
  /** Texto incremental. Undefined em chunks de metadata terminal. */
  text?: string
  /**
   * Motivo de parada (provider-specific). Valores Gemini: 'STOP',
   * 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER'. Valores Anthropic:
   * 'end_turn', 'max_tokens', 'stop_sequence', 'tool_use'.
   *
   * Caller deve checar este campo no fim do stream — alguns providers
   * abortam mid-response (Gemini RECITATION p.ex.) e UI precisa avisar.
   */
  finishReason?: string
  /** Tokens consumidos. Geralmente so vem no chunk final. */
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
  provider: AiProviderName
  modelId: string
}

export interface AiProvider {
  name: AiProviderName
  generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse>
  /**
   * Streaming opcional. Providers que nao suportam (poucos) lancam erro.
   * Provider deve retornar AsyncIterable que termina apos emitir chunks
   * (e idealmente um chunk final com `finishReason` + `usage`).
   */
  generateStream?(modelId: string, req: AiGenerateRequest): Promise<AsyncIterable<AiStreamChunk>>
}
