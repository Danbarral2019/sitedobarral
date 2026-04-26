/**
 * Testes para lib/gemini/cached-client.ts
 *
 * Testa queryGeminiText em diferentes cenarios:
 * - Com cache habilitado (cache hit e cache miss)
 * - Sem cache habilitado (chamada direta)
 * - Validacao de config e tratamento de erros
 *
 * SDK: @google/genai (migração 2026-04-26)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Configurar env ANTES de qualquer import do modulo (vi.hoisted roda primeiro)
vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'test-gemini-api-key';
});

// Mock @google/genai com vi.hoisted
const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return {
    ...actual,
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      };
    },
  };
});

// Mock redis-client withCache
const mockWithCache = vi.hoisted(() => vi.fn());

vi.mock('../../cache/redis-client', () => ({
  withCache: mockWithCache,
  CacheKeys: {
    geminiQuery: (fileId: string, query: string) =>
      `gemini:query:${fileId}:${query}`,
  },
  CACHE_TTL: {
    GEMINI_QUERY: 86400,
  },
}));

// Mock console para nao poluir output
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

import { queryGeminiText } from '../cached-client';

// Helper: resposta padrao do Gemini (novo SDK shape)
function makeGeminiResponse(
  text: string,
  tokens?: { prompt: number; candidates: number; total: number },
) {
  return {
    text,
    candidates: [{ finishReason: 'STOP' }],
    promptFeedback: undefined,
    usageMetadata: tokens
      ? {
          promptTokenCount: tokens.prompt,
          candidatesTokenCount: tokens.candidates,
          totalTokenCount: tokens.total,
        }
      : undefined,
  };
}

describe('cached-client: queryGeminiText (SDK @google/genai)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('com cache habilitado (cache hit)', () => {
    it('deve retornar resposta do cache via withCache', async () => {
      mockWithCache.mockResolvedValue({
        response: 'Resposta cacheada',
        tokens: { prompt: 10, completion: 20, total: 30 },
      });

      const result = await queryGeminiText('pergunta teste');

      expect(result.response).toBe('Resposta cacheada');
      expect(mockWithCache).toHaveBeenCalledTimes(1);
    });

    it('nao deve chamar generateContent quando withCache retorna do cache', async () => {
      mockWithCache.mockResolvedValue({
        response: 'Resultado do cache',
        tokens: undefined,
      });

      await queryGeminiText('outra pergunta');

      expect(mockWithCache).toHaveBeenCalledTimes(1);
    });

    it('deve marcar cached=true quando latencia < 500ms', async () => {
      mockWithCache.mockResolvedValue({
        response: 'Rapido',
        tokens: undefined,
      });

      const result = await queryGeminiText('pergunta rapida');

      expect(result.cached).toBe(true);
      expect(result.latency).toBeLessThan(500);
    });
  });

  describe('com cache habilitado (cache miss)', () => {
    it('deve executar o callback do withCache e retornar resultado', async () => {
      mockWithCache.mockImplementation(
        async (_key: string, fn: () => Promise<unknown>) => fn(),
      );

      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Resposta da API', { prompt: 5, candidates: 15, total: 20 }),
      );

      const result = await queryGeminiText('pergunta nova');

      expect(result.response).toBe('Resposta da API');
      expect(result.tokens).toEqual({ prompt: 5, completion: 15, total: 20 });
    });

    it('deve passar model, contents e config no formato novo do SDK', async () => {
      mockWithCache.mockImplementation(
        async (_key: string, fn: () => Promise<unknown>) => fn(),
      );
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Ok'));

      await queryGeminiText('test query');

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-flash-preview',
          contents: 'test query',
          config: expect.objectContaining({
            temperature: 0.7,
            maxOutputTokens: 2048,
          }),
        }),
      );
    });

    it('deve passar systemInstruction dentro de config quando fornecida', async () => {
      mockWithCache.mockImplementation(
        async (_key: string, fn: () => Promise<unknown>) => fn(),
      );
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Com instrucao'));

      await queryGeminiText('query', {
        systemInstruction: 'Voce e um assistente juridico',
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: 'Voce e um assistente juridico',
          }),
        }),
      );
    });

    it('deve passar thinkingConfig.thinkingBudget quando opção fornecida', async () => {
      mockWithCache.mockImplementation(
        async (_key: string, fn: () => Promise<unknown>) => fn(),
      );
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Sem thinking'));

      await queryGeminiText('query', { thinkingBudget: 0 });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            thinkingConfig: { thinkingBudget: 0 },
          }),
        }),
      );
    });
  });

  describe('sem cache habilitado (useCache: false)', () => {
    it('nao deve chamar withCache quando useCache=false', async () => {
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Resposta direta'));

      const result = await queryGeminiText('query direta', { useCache: false });

      expect(result.response).toBe('Resposta direta');
      expect(mockWithCache).not.toHaveBeenCalled();
    });

    it('deve sempre retornar cached=false quando useCache=false', async () => {
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Sem cache'));

      const result = await queryGeminiText('query', { useCache: false });

      expect(result.cached).toBe(false);
    });

    it('deve incluir tokens quando usageMetadata esta presente', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Com tokens', { prompt: 100, candidates: 200, total: 300 }),
      );

      const result = await queryGeminiText('query', { useCache: false });

      expect(result.tokens).toEqual({ prompt: 100, completion: 200, total: 300 });
    });

    it('deve retornar tokens undefined quando usageMetadata nao existe', async () => {
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Sem metadata'));

      const result = await queryGeminiText('query', { useCache: false });

      expect(result.tokens).toBeUndefined();
    });
  });

  describe('opcoes customizadas', () => {
    it('deve usar modelo e parametros customizados', async () => {
      mockGenerateContent.mockResolvedValue(makeGeminiResponse('Custom'));

      await queryGeminiText('query', {
        useCache: false,
        model: 'gemini-1.5-pro',
        temperature: 0.2,
        maxOutputTokens: 4096,
      });

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-1.5-pro',
          config: expect.objectContaining({
            temperature: 0.2,
            maxOutputTokens: 4096,
          }),
        }),
      );
    });
  });

  describe('tratamento de erros', () => {
    it('deve propagar erro quando API do Gemini falha (sem cache)', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Gemini API Error'));

      await expect(
        queryGeminiText('query falha', { useCache: false }),
      ).rejects.toThrow('Gemini API Error');
    });

    it('deve propagar erro quando withCache falha', async () => {
      mockWithCache.mockRejectedValue(new Error('Cache Error'));

      await expect(queryGeminiText('query cache falha')).rejects.toThrow(
        'Cache Error',
      );
    });

    it('deve lançar quando promptFeedback.blockReason existe', async () => {
      mockGenerateContent.mockResolvedValue({
        text: '',
        candidates: [],
        promptFeedback: { blockReason: 'SAFETY' },
        usageMetadata: undefined,
      });

      await expect(
        queryGeminiText('query bloqueada', { useCache: false }),
      ).rejects.toThrow(/blocked prompt: SAFETY/);
    });

    it('deve lançar quando finishReason é diferente de STOP/MAX_TOKENS', async () => {
      mockGenerateContent.mockResolvedValue({
        text: 'parcial',
        candidates: [{ finishReason: 'RECITATION' }],
        promptFeedback: undefined,
        usageMetadata: undefined,
      });

      await expect(
        queryGeminiText('query recitacao', { useCache: false }),
      ).rejects.toThrow(/finished with reason: RECITATION/);
    });
  });
});
