// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock logger before importing generate
vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  authLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { generate } from '@/lib/ai'

const hasGemini = !!process.env.GEMINI_API_KEY
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY

describe('lib/ai generate (smoke, requer chaves)', () => {
  it.skipIf(!hasGemini)('chama Gemini default em search', async () => {
    const r = await generate('search', {
      messages: [{ role: 'user', content: 'Responda apenas: ok' }],
      maxTokens: 10,
      temperature: 0,
    })
    expect(r.provider).toBe('gemini')
    expect(r.text.length).toBeGreaterThan(0)
  }, 30_000)

  it.skipIf(!hasAnthropic)('chama Anthropic default em classification', async () => {
    const r = await generate('classification', {
      messages: [{ role: 'user', content: 'Responda apenas: ok' }],
      maxTokens: 10,
      temperature: 0,
    })
    expect(r.provider).toBe('anthropic')
    expect(r.text.length).toBeGreaterThan(0)
  }, 30_000)
})
