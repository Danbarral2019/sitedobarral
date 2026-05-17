/**
 * Tests do cached-client (thin wrapper sobre lib/ai).
 *
 * Pos PR 4.4b.5.b, cached-client e wrapper sobre `generate()` do lib/ai —
 * tests mockam `@/lib/ai` em vez do SDK @google/genai direto, alinhando
 * com a camada que efetivamente importamos.
 *
 * Cobertura:
 *   - Mapeamento de opcoes legacy -> generate() request
 *   - Defaults Gemini-especificos (provider, safety, fallback, thinkingBudget)
 *   - Cache opt-in (useCache true/false, cacheTTL)
 *   - Mapeamento do resultado (text, tokens, latency, cached flag)
 *   - Propagacao de erros (blockReason, finishReason, 429)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock('@/lib/ai', () => ({
  generate: mockGenerate,
  LEGAL_SAFETY_SETTINGS: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  ],
}));

vi.mock('../config', () => ({
  PRIMARY_GEMINI_MODEL: 'gemini-3-flash-preview',
  FALLBACK_GEMINI_MODELS: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
}));

vi.mock('../../cache/redis-client', () => ({
  CacheKeys: {
    geminiQuery: (fileId: string, query: string) => `gemini:query:${fileId}:${query}`,
  },
  CACHE_TTL: { GEMINI_QUERY: 86400 },
}));

import { queryGeminiText } from '../cached-client';

const baseResult = {
  text: 'mock response',
  inputTokens: 10,
  outputTokens: 20,
  provider: 'gemini' as const,
  modelId: 'gemini-3-flash-preview',
};

describe('cached-client: queryGeminiText (thin wrapper)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGenerate.mockResolvedValue(baseResult);
  });

  describe('mapeamento de opcoes legacy -> generate()', () => {
    it('encaminha pra task=chat com messages [{role:user, content}]', async () => {
      await queryGeminiText('minha pergunta');
      expect(mockGenerate).toHaveBeenCalledWith(
        'chat',
        expect.objectContaining({
          messages: [{ role: 'user', content: 'minha pergunta' }],
        }),
      );
    });

    it('forca provider=gemini (cached-client e Gemini-only)', async () => {
      await queryGeminiText('q');
      expect(mockGenerate).toHaveBeenCalledWith(
        'chat',
        expect.objectContaining({ provider: 'gemini' }),
      );
    });

    it('inclui LEGAL_SAFETY_SETTINGS sempre', async () => {
      await queryGeminiText('q');
      const args = mockGenerate.mock.calls[0][1];
      expect(args.safetySettings).toHaveLength(4);
      expect(args.safetySettings[0]).toMatchObject({
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH',
      });
    });

    it('deduplica modelo principal dos fallbackModels', async () => {
      await queryGeminiText('q', { model: 'gemini-2.5-flash' });
      const args = mockGenerate.mock.calls[0][1];
      expect(args.fallbackModels).not.toContain('gemini-2.5-flash');
      expect(args.fallbackModels).toContain('gemini-2.5-flash-lite');
    });

    it('mapeia systemInstruction -> systemPrompt', async () => {
      await queryGeminiText('q', { systemInstruction: 'voce e um juiz' });
      expect(mockGenerate).toHaveBeenCalledWith(
        'chat',
        expect.objectContaining({ systemPrompt: 'voce e um juiz' }),
      );
    });

    it('omite systemPrompt quando systemInstruction nao fornecida', async () => {
      await queryGeminiText('q');
      const args = mockGenerate.mock.calls[0][1];
      expect(args.systemPrompt).toBeUndefined();
    });

    it('mapeia maxOutputTokens -> maxTokens', async () => {
      await queryGeminiText('q', { maxOutputTokens: 4096 });
      expect(mockGenerate).toHaveBeenCalledWith(
        'chat',
        expect.objectContaining({ maxTokens: 4096 }),
      );
    });

    it('aplica thinkingBudget=0 por default (protecao LeiIndexer P0.1)', async () => {
      await queryGeminiText('q');
      expect(mockGenerate).toHaveBeenCalledWith(
        'chat',
        expect.objectContaining({ thinkingBudget: 0 }),
      );
    });

    it('permite thinkingBudget=-1 (dynamic thinking opt-in)', async () => {
      await queryGeminiText('q', { thinkingBudget: -1 });
      expect(mockGenerate).toHaveBeenCalledWith(
        'chat',
        expect.objectContaining({ thinkingBudget: -1 }),
      );
    });

    it('passa modelo e temperature customizados', async () => {
      await queryGeminiText('q', { model: 'gemini-2.0-flash', temperature: 0.2 });
      expect(mockGenerate).toHaveBeenCalledWith(
        'chat',
        expect.objectContaining({
          model: 'gemini-2.0-flash',
          temperature: 0.2,
        }),
      );
    });
  });

  describe('cache opt-in', () => {
    it('inclui cache option quando useCache=true (default)', async () => {
      await queryGeminiText('minha query');
      const args = mockGenerate.mock.calls[0][1];
      expect(args.cache).toEqual({
        key: 'gemini:query:text:minha query',
        ttl: 86400,
      });
    });

    it('omite cache option quando useCache=false', async () => {
      await queryGeminiText('q', { useCache: false });
      const args = mockGenerate.mock.calls[0][1];
      expect(args.cache).toBeUndefined();
    });

    it('respeita cacheTTL custom', async () => {
      await queryGeminiText('q', { cacheTTL: 3600 });
      const args = mockGenerate.mock.calls[0][1];
      expect(args.cache?.ttl).toBe(3600);
    });
  });

  describe('mapeamento do resultado', () => {
    it('mapeia text -> response', async () => {
      mockGenerate.mockResolvedValueOnce({ ...baseResult, text: 'resposta' });
      const result = await queryGeminiText('q');
      expect(result.response).toBe('resposta');
    });

    it('mapeia tokens quando presentes', async () => {
      mockGenerate.mockResolvedValueOnce({
        ...baseResult,
        inputTokens: 100,
        outputTokens: 200,
      });
      const result = await queryGeminiText('q');
      expect(result.tokens).toEqual({ prompt: 100, completion: 200, total: 300 });
    });

    it('tokens=undefined quando provider nao retorna inputTokens', async () => {
      mockGenerate.mockResolvedValueOnce({
        text: 'r',
        provider: 'gemini',
        modelId: 'x',
      });
      const result = await queryGeminiText('q');
      expect(result.tokens).toBeUndefined();
    });

    it('completion=0 quando outputTokens ausente mas inputTokens presente', async () => {
      mockGenerate.mockResolvedValueOnce({
        text: 'r',
        inputTokens: 50,
        provider: 'gemini',
        modelId: 'x',
      });
      const result = await queryGeminiText('q');
      expect(result.tokens).toEqual({ prompt: 50, completion: 0, total: 50 });
    });

    it('cached=true quando useCache=true E latency < 500', async () => {
      const result = await queryGeminiText('q');
      expect(result.cached).toBe(true);
    });

    it('cached=false quando useCache=false (independente de latencia)', async () => {
      const result = await queryGeminiText('q', { useCache: false });
      expect(result.cached).toBe(false);
    });

    it('latency sempre presente (Date.now() delta)', async () => {
      const result = await queryGeminiText('q');
      expect(typeof result.latency).toBe('number');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('propagacao de erros (lib/ai ja lanca)', () => {
    it('propaga blockReason: SAFETY', async () => {
      mockGenerate.mockRejectedValueOnce(new Error('Gemini blocked prompt: SAFETY'));
      await expect(queryGeminiText('q')).rejects.toThrow(/blocked prompt: SAFETY/);
    });

    it('propaga finishReason !== STOP/MAX_TOKENS (ex: RECITATION)', async () => {
      mockGenerate.mockRejectedValueOnce(
        new Error('Gemini finished with reason: RECITATION'),
      );
      await expect(queryGeminiText('q')).rejects.toThrow(/RECITATION/);
    });

    it('propaga 429 quota apos cascade esgotar', async () => {
      mockGenerate.mockRejectedValueOnce(new Error('429 quota exceeded'));
      await expect(queryGeminiText('q')).rejects.toThrow(/429/);
    });
  });
});
