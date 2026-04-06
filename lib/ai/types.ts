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
