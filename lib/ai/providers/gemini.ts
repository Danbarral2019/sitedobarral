import type { AiProvider, AiGenerateRequest, AiGenerateResponse } from '../types'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export const geminiProvider: AiProvider = {
  name: 'gemini',
  async generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

    const contents = req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    // responseSchema implica JSON output mesmo sem jsonMode explicito — alinha
    // com o comportamento padrao da SDK @google/genai (presenca do schema ja
    // forca application/json).
    const wantsJson = req.jsonMode || req.responseSchema !== undefined
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.3,
        maxOutputTokens: req.maxTokens ?? 4096,
        ...(wantsJson ? { responseMimeType: 'application/json' } : {}),
        ...(req.responseSchema !== undefined && { responseSchema: req.responseSchema }),
        ...(req.thinkingBudget !== undefined && {
          thinkingConfig: { thinkingBudget: req.thinkingBudget },
        }),
      },
    }
    if (req.systemPrompt) {
      body.systemInstruction = { parts: [{ text: req.systemPrompt }] }
    }

    const res = await fetch(`${BASE_URL}/models/${modelId}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Gemini API error ${res.status}: ${errBody}`)
    }

    const data = await res.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const usage = data.usageMetadata ?? {}

    return {
      text,
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      provider: 'gemini',
      modelId,
    }
  },
}
