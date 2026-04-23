// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveTask } from '@/lib/ai/registry'

describe('lib/ai/registry', () => {
  const ENV_KEYS = [
    'AI_SEARCH_PROVIDER',
    'AI_SEARCH_MODEL',
    'AI_CHAT_PROVIDER',
    'AI_CHAT_MODEL',
    'AI_EXTRACTION_PROVIDER',
    'AI_EXTRACTION_MODEL',
    'AI_CLASSIFICATION_PROVIDER',
    'AI_CLASSIFICATION_MODEL',
    'AI_SUMMARIZATION_PROVIDER',
    'AI_SUMMARIZATION_MODEL',
    'AI_ENHANCEMENT_PROVIDER',
    'AI_ENHANCEMENT_MODEL',
  ]

  const originals: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      originals[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originals[k] === undefined) delete process.env[k]
      else process.env[k] = originals[k]
    }
  })

  it('search default e Gemini 2.5 Flash', () => {
    const r = resolveTask('search')
    expect(r.provider.name).toBe('gemini')
    expect(r.modelId).toBe('gemini-2.5-flash')
  })

  it('chat default e Gemini 2.5 Flash', () => {
    const r = resolveTask('chat')
    expect(r.provider.name).toBe('gemini')
    expect(r.modelId).toBe('gemini-2.5-flash')
  })

  it('extraction default e Gemini 2.5 Flash', () => {
    const r = resolveTask('extraction')
    expect(r.provider.name).toBe('gemini')
    expect(r.modelId).toBe('gemini-2.5-flash')
  })

  it('classification default e Claude 3.5 Haiku', () => {
    const r = resolveTask('classification')
    expect(r.provider.name).toBe('anthropic')
    expect(r.modelId).toBe('claude-haiku-4-5-20251001')
  })

  it('summarization default e Claude 3.5 Haiku', () => {
    const r = resolveTask('summarization')
    expect(r.provider.name).toBe('anthropic')
    expect(r.modelId).toBe('claude-haiku-4-5-20251001')
  })

  it('enhancement default e Claude Sonnet 4', () => {
    const r = resolveTask('enhancement')
    expect(r.provider.name).toBe('anthropic')
    expect(r.modelId).toBe('claude-sonnet-4-20250514')
  })

  it('permite trocar search para Gemini 2.5 Pro via env', () => {
    process.env.AI_SEARCH_PROVIDER = 'gemini'
    process.env.AI_SEARCH_MODEL = 'gemini-2.5-pro'
    const r = resolveTask('search')
    expect(r.provider.name).toBe('gemini')
    expect(r.modelId).toBe('gemini-2.5-pro')
  })

  it('permite trocar enhancement para Anthropic Opus via env', () => {
    process.env.AI_ENHANCEMENT_PROVIDER = 'anthropic'
    process.env.AI_ENHANCEMENT_MODEL = 'claude-opus-4-6'
    const r = resolveTask('enhancement')
    expect(r.provider.name).toBe('anthropic')
    expect(r.modelId).toBe('claude-opus-4-6')
  })

  it('lanca erro para provider desconhecido', () => {
    process.env.AI_CHAT_PROVIDER = 'openai'
    expect(() => resolveTask('chat')).toThrow(/Unknown AI provider/)
  })
})
