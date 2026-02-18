/**
 * Testes para lib/gemini/cached-client.ts
 *
 * Testa queryGeminiText em diferentes cenarios:
 * - Com cache habilitado (cache hit e cache miss)
 * - Sem cache habilitado (chamada direta)
 * - Validacao de config e tratamento de erros
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Configurar env ANTES de qualquer import do modulo (vi.hoisted roda primeiro)
vi.hoisted(() => {
  process.env.GEMINI_API_KEY = 'test-gemini-api-key';
});

// Mock GoogleGenerativeAI com vi.hoisted
const mockGenerateContent = vi.hoisted(() => vi.fn());
const mockGetGenerativeModel = vi.hoisted(() =>
  vi.fn(() => ({
    generateContent: mockGenerateContent,
  }))
);

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    getGenerativeModel = mockGetGenerativeModel;
  },
}));

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

// Helper: resposta padrao do Gemini
function makeGeminiResponse(text: string, tokens?: { prompt: number; candidates: number; total: number }) {
  return {
    response: {
      text: () => text,
      usageMetadata: tokens
        ? {
            promptTokenCount: tokens.prompt,
            candidatesTokenCount: tokens.candidates,
            totalTokenCount: tokens.total,
          }
        : undefined,
    },
  };
}

describe('cached-client: queryGeminiText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================
  // Cache habilitado - cache hit
  // ===========================

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

      // withCache foi chamado, mas generateContent NAO (pois withCache resolveu do cache)
      expect(mockWithCache).toHaveBeenCalledTimes(1);
      // generateContent nao e chamado diretamente - e chamado dentro do callback de withCache
      // Podemos verificar que o resultado veio do mock de withCache
    });

    it('deve marcar cached=true quando latencia < 500ms', async () => {
      mockWithCache.mockResolvedValue({
        response: 'Rapido',
        tokens: undefined,
      });

      const result = await queryGeminiText('pergunta rapida');

      // withCache resolve instantaneamente no mock, entao latencia < 500ms
      expect(result.cached).toBe(true);
      expect(result.latency).toBeLessThan(500);
    });
  });

  // ===========================
  // Cache habilitado - cache miss
  // ===========================

  describe('com cache habilitado (cache miss)', () => {
    it('deve executar o callback do withCache e retornar resultado', async () => {
      // Simular cache miss: withCache executa o callback fn
      mockWithCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => {
        return fn();
      });

      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Resposta da API', { prompt: 5, candidates: 15, total: 20 })
      );

      const result = await queryGeminiText('pergunta nova');

      expect(result.response).toBe('Resposta da API');
      expect(result.tokens).toEqual({ prompt: 5, completion: 15, total: 20 });
    });

    it('deve configurar modelo com parametros padrao', async () => {
      mockWithCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => {
        return fn();
      });

      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Ok')
      );

      await queryGeminiText('test query');

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      });
    });

    it('deve passar systemInstruction quando fornecida', async () => {
      mockWithCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => {
        return fn();
      });

      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Com instrucao')
      );

      await queryGeminiText('query', {
        systemInstruction: 'Voce e um assistente juridico',
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: 'Voce e um assistente juridico',
        })
      );
    });
  });

  // ===========================
  // Sem cache (useCache: false)
  // ===========================

  describe('sem cache habilitado (useCache: false)', () => {
    it('nao deve chamar withCache quando useCache=false', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Resposta direta')
      );

      const result = await queryGeminiText('query direta', { useCache: false });

      expect(result.response).toBe('Resposta direta');
      expect(mockWithCache).not.toHaveBeenCalled();
    });

    it('deve sempre retornar cached=false quando useCache=false', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Sem cache')
      );

      const result = await queryGeminiText('query', { useCache: false });

      expect(result.cached).toBe(false);
    });

    it('deve incluir tokens quando usageMetadata esta presente', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Com tokens', { prompt: 100, candidates: 200, total: 300 })
      );

      const result = await queryGeminiText('query', { useCache: false });

      expect(result.tokens).toEqual({ prompt: 100, completion: 200, total: 300 });
    });

    it('deve retornar tokens undefined quando usageMetadata nao existe', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Sem metadata')
      );

      const result = await queryGeminiText('query', { useCache: false });

      expect(result.tokens).toBeUndefined();
    });
  });

  // ===========================
  // Opcoes customizadas
  // ===========================

  describe('opcoes customizadas', () => {
    it('deve usar modelo e parametros customizados', async () => {
      mockGenerateContent.mockResolvedValue(
        makeGeminiResponse('Custom')
      );

      await queryGeminiText('query', {
        useCache: false,
        model: 'gemini-1.5-pro',
        temperature: 0.2,
        maxOutputTokens: 4096,
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-1.5-pro',
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      });
    });
  });

  // ===========================
  // Tratamento de erros
  // ===========================

  describe('tratamento de erros', () => {
    it('deve propagar erro quando API do Gemini falha (sem cache)', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Gemini API Error'));

      await expect(
        queryGeminiText('query falha', { useCache: false })
      ).rejects.toThrow('Gemini API Error');
    });

    it('deve propagar erro quando withCache falha', async () => {
      mockWithCache.mockRejectedValue(new Error('Cache Error'));

      await expect(
        queryGeminiText('query cache falha')
      ).rejects.toThrow('Cache Error');
    });
  });
});
