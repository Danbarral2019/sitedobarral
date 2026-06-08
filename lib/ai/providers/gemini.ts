/**
 * Provider Gemini via @google/genai SDK.
 *
 * Suporta generate() + generateStream() com features completas:
 *   - systemInstruction (via req.systemPrompt)
 *   - jsonMode / responseSchema (structured output)
 *   - thinkingBudget (Gemini 2.5+)
 *   - safetySettings (preset LEGAL_SAFETY_SETTINGS em lib/ai/safety)
 *   - streaming via models.generateContentStream
 *
 * Cliente instanciado por chamada (sem cache em memória) para suportar
 * fallback entre GEMINI_API_KEY e GEMINI_API_KEY_BACKUP via
 * withGeminiKeyFallback. Custo de instanciar GoogleGenAI é desprezível
 * (SDK só abre conexão na primeira chamada de método).
 *
 * Streaming + fallback: cascade entre keys só ocorre na INICIAÇÃO do stream
 * (antes do primeiro chunk). Erro mid-stream propaga sem trocar de key
 * porque tokens já foram entregues ao cliente.
 */

import { GoogleGenAI } from '@google/genai'
import { withGeminiKeyFallback } from '@/lib/gemini/api-key-fallback'
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiProvider,
  AiStreamChunk,
} from '../types'

function mapContents(req: AiGenerateRequest) {
  return req.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

function buildConfig(req: AiGenerateRequest): Record<string, unknown> {
  // responseSchema implica JSON output mesmo sem jsonMode explicito — alinha
  // com o comportamento padrao da SDK @google/genai.
  const wantsJson = req.jsonMode || req.responseSchema !== undefined
  const config: Record<string, unknown> = {
    temperature: req.temperature ?? 0.3,
    maxOutputTokens: req.maxTokens ?? 4096,
  }
  if (req.systemPrompt) {
    config.systemInstruction = req.systemPrompt
  }
  if (wantsJson) {
    config.responseMimeType = 'application/json'
  }
  if (req.responseSchema !== undefined) {
    config.responseSchema = req.responseSchema
  }
  if (req.thinkingBudget !== undefined) {
    config.thinkingConfig = { thinkingBudget: req.thinkingBudget }
  }
  if (req.safetySettings && req.safetySettings.length > 0) {
    config.safetySettings = req.safetySettings
  }
  return config
}

export const geminiProvider: AiProvider = {
  name: 'gemini',

  async generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse> {
    return withGeminiKeyFallback(async (apiKey) => {
      const client = new GoogleGenAI({ apiKey })
      const result = await client.models.generateContent({
        model: modelId,
        contents: mapContents(req),
        config: buildConfig(req),
      })

      // Checks que cached-client legacy fazia — promovidos pra dentro do provider
      // pra detectar problemas semanticos (RECITATION, SAFETY) em vez de
      // retornar string vazia silenciosamente.
      const blockReason = result.promptFeedback?.blockReason
      if (blockReason) {
        throw new Error(`Gemini blocked prompt: ${blockReason}`)
      }
      const finishReason = result.candidates?.[0]?.finishReason
      if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
        throw new Error(`Gemini finished with reason: ${finishReason}`)
      }

      return {
        text: result.text ?? '',
        inputTokens: result.usageMetadata?.promptTokenCount,
        outputTokens: result.usageMetadata?.candidatesTokenCount,
        provider: 'gemini',
        modelId,
      }
    })
  },

  async generateStream(
    modelId: string,
    req: AiGenerateRequest,
  ): Promise<AsyncIterable<AiStreamChunk>> {
    return withGeminiKeyFallback(async (apiKey) => {
      const client = new GoogleGenAI({ apiKey })
      const stream = await client.models.generateContentStream({
        model: modelId,
        contents: mapContents(req),
        config: buildConfig(req),
      })

      // Wrap em async generator para mapear chunks SDK -> AiStreamChunk.
      // finishReason + usage saem do ultimo chunk (SDK acumula metadata ali).
      return (async function* (): AsyncGenerator<AiStreamChunk> {
        type GenAIChunk = {
          text?: string
          candidates?: Array<{ finishReason?: string }>
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
        }
        let lastChunk: GenAIChunk | undefined
        for await (const chunk of stream as AsyncIterable<GenAIChunk>) {
          lastChunk = chunk
          const text = chunk.text
          if (text) {
            yield { text, provider: 'gemini', modelId }
          }
        }
        // Chunk terminal — emite finishReason + usage se disponiveis.
        const finishReason = lastChunk?.candidates?.[0]?.finishReason
        const usage = lastChunk?.usageMetadata
        yield {
          finishReason,
          usage: usage
            ? {
                inputTokens: usage.promptTokenCount,
                outputTokens: usage.candidatesTokenCount,
              }
            : undefined,
          provider: 'gemini',
          modelId,
        }
      })()
    })
  },
}
