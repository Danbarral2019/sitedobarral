import Anthropic from '@anthropic-ai/sdk'
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiProvider,
  AiStreamChunk,
  AiCitation,
} from '../types'

/**
 * Monta os `messages` da API. Quando `req.documents` está presente (Citations
 * API), anexa os documentos como blocos `document` com `citations: enabled` na
 * PRIMEIRA mensagem do usuário, seguidos do texto original (a pergunta/prompt).
 */
function buildMessages(req: AiGenerateRequest): Anthropic.MessageParam[] {
  const docs = req.documents
  let attached = false
  return req.messages.map((m): Anthropic.MessageParam => {
    if (docs && docs.length > 0 && m.role === 'user' && !attached) {
      attached = true
      return {
        role: 'user',
        content: [
          ...docs.map((d) => ({
            type: 'document' as const,
            source: {
              type: 'text' as const,
              media_type: 'text/plain' as const,
              data: d.text,
            },
            title: d.title,
            citations: { enabled: true },
          })),
          { type: 'text' as const, text: m.content },
        ],
      }
    }
    return { role: m.role, content: m.content }
  })
}

/** Extrai as citações `char_location` dos blocos de texto da resposta. */
export function extractCitations(content: Anthropic.ContentBlock[]): AiCitation[] {
  const out: AiCitation[] = []
  for (const block of content) {
    if (block.type !== 'text' || !block.citations) continue
    for (const c of block.citations) {
      if (c.type === 'char_location') {
        out.push({
          citedText: c.cited_text,
          documentIndex: c.document_index,
          documentTitle: c.document_title ?? undefined,
          startCharIndex: c.start_char_index,
          endCharIndex: c.end_char_index,
        })
      }
    }
  }
  return out
}

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
    client = new Anthropic({ apiKey })
  }
  return client
}

function buildSystem(req: AiGenerateRequest): string | undefined {
  let system = req.systemPrompt
  if (req.jsonMode || req.responseSchema !== undefined) {
    // Anthropic nao tem structured output via schema — usa prompt augmentation.
    system =
      (system ? system + '\n\n' : '') +
      'IMPORTANTE: Responda APENAS com JSON valido, sem markdown, sem cercas de codigo, sem texto explicativo antes ou depois.'
  }
  return system
}

export const anthropicProvider: AiProvider = {
  name: 'anthropic',

  async generate(modelId: string, req: AiGenerateRequest): Promise<AiGenerateResponse> {
    const c = getClient()
    const system = buildSystem(req)
    const messages = buildMessages(req)

    const resp = await c.messages.create({
      model: modelId,
      max_tokens: req.maxTokens ?? 4096,
      // Modelos recentes (Sonnet 5, Opus 4.x) DEPRECARAM `temperature` e
      // rejeitam a requisição se ele for enviado. Só incluímos quando o caller
      // passa explicitamente — senão deixamos o modelo usar seu default.
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(system ? { system } : {}),
      messages,
    })

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const citations = req.documents?.length
      ? extractCitations(resp.content)
      : undefined

    return {
      text,
      inputTokens: resp.usage?.input_tokens,
      outputTokens: resp.usage?.output_tokens,
      provider: 'anthropic',
      modelId,
      ...(citations ? { citations } : {}),
    }
  },

  async generateStream(
    modelId: string,
    req: AiGenerateRequest,
  ): Promise<AsyncIterable<AiStreamChunk>> {
    const c = getClient()
    const system = buildSystem(req)
    const messages = buildMessages(req)

    // Anthropic SDK .stream() retorna MessageStream com async iterator de
    // eventos e .finalMessage() para metadata terminal.
    const stream = c.messages.stream({
      model: modelId,
      max_tokens: req.maxTokens ?? 4096,
      // Modelos recentes (Sonnet 5, Opus 4.x) DEPRECARAM `temperature` e
      // rejeitam a requisição se ele for enviado. Só incluímos quando o caller
      // passa explicitamente — senão deixamos o modelo usar seu default.
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(system ? { system } : {}),
      messages,
    })

    return (async function* (): AsyncGenerator<AiStreamChunk> {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { text: event.delta.text, provider: 'anthropic', modelId }
        }
      }
      // Final metadata (stop_reason + usage).
      const final = await stream.finalMessage()
      yield {
        finishReason: final.stop_reason ?? undefined,
        usage: {
          inputTokens: final.usage?.input_tokens,
          outputTokens: final.usage?.output_tokens,
        },
        provider: 'anthropic',
        modelId,
      }
    })()
  },
}
