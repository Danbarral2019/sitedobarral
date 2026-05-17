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
 * Cliente lazy-init e cached por process (igual cached-client legacy).
 */

import { GoogleGenAI } from '@google/genai'
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiProvider,
  AiStreamChunk,
} from '../types'

let _client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (_client) return _client
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  _client = new GoogleGenAI({ apiKey })
  return _client
}

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
    const client = getClient()
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
  },

  async generateStream(
    modelId: string,
    req: AiGenerateRequest,
  ): Promise<AsyncIterable<AiStreamChunk>> {
    const client = getClient()
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
  },
}
