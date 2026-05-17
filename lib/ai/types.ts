/**
 * Camada de abstracao de provedores de LLM.
 *
 * Permite trocar o modelo/provedor de cada tarefa via env vars
 * (AI_<TASK>_PROVIDER, AI_<TASK>_MODEL) sem mexer no codigo dos chamadores.
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

export interface AiProvider {
  name: AiProviderName
  generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse>
}
