import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do SDK: devolve um vetor com o tamanho pedido em config.outputDimensionality.
// Nota: usamos `arg?.config` (em vez de destructuring direto de `{ config }`)
// porque o próprio Vitest v4 invoca mocks criados via vi.fn() uma vez extra,
// sem argumentos, durante a fase de cleanup do teste (instrumentação interna
// de traces) — sem isso, essa chamada fantasma derruba o teste com
// "Cannot destructure property 'config' of 'undefined'" mesmo com a
// implementação correta.
const embedContent = vi.fn(async (arg?: { config: { outputDimensionality: number } }) => ({
  embeddings: [{ values: Array.from({ length: arg?.config?.outputDimensionality ?? 0 }, () => 0.1) }],
}))
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { models: { embedContent } }
  }),
}))
// withGeminiKeyFallback apenas injeta uma apiKey e executa o callback.
vi.mock('@/lib/gemini/api-key-fallback', () => ({
  withGeminiKeyFallback: (fn: (k: string) => unknown) => fn('test-key'),
}))

describe('generateEmbedding — dimensão parametrizável', () => {
  beforeEach(() => embedContent.mockClear())

  it('usa 768 por default', async () => {
    const { generateEmbedding } = await import('../gemini-embeddings')
    const r = await generateEmbedding('texto')
    expect(r.dimension).toBe(768)
    expect(r.embedding).toHaveLength(768)
    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ outputDimensionality: 768 }) }),
    )
  })

  it('respeita a dimensão 1536 quando pedida', async () => {
    const { generateEmbedding } = await import('../gemini-embeddings')
    const r = await generateEmbedding('texto', 1536)
    expect(r.dimension).toBe(1536)
    expect(r.embedding).toHaveLength(1536)
    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ outputDimensionality: 1536 }) }),
    )
  })
})
