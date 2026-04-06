import Anthropic from '@anthropic-ai/sdk'
import type { AiProvider, AiGenerateRequest, AiGenerateResponse } from '../types'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
    client = new Anthropic({ apiKey })
  }
  return client
}

export const anthropicProvider: AiProvider = {
  name: 'anthropic',
  async generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse> {
    const c = getClient()

    let system = req.systemPrompt
    if (req.jsonMode) {
      system = (system ? system + '\n\n' : '') +
        'IMPORTANTE: Responda APENAS com JSON valido, sem markdown, sem cercas de codigo, sem texto explicativo antes ou depois.'
    }

    const messages = req.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const resp = await c.messages.create({
      model: modelId,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.3,
      ...(system ? { system } : {}),
      messages,
    })

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    return {
      text,
      inputTokens: resp.usage?.input_tokens,
      outputTokens: resp.usage?.output_tokens,
      provider: 'anthropic',
      modelId,
    }
  },
}
