/**
 * Tests da camada generate() — cache, fallback, retry, log estruturado.
 * Mocka providers e cache pra isolar a logica de orquestracao.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks de providers — vi.hoisted pra subir antes dos imports.
const { mockGeminiGenerate, mockAnthropicGenerate } = vi.hoisted(() => ({
  mockGeminiGenerate: vi.fn(),
  mockAnthropicGenerate: vi.fn(),
}));

vi.mock('../providers/gemini', () => ({
  geminiProvider: {
    name: 'gemini',
    generate: mockGeminiGenerate,
  },
}));

vi.mock('../providers/anthropic', () => ({
  anthropicProvider: {
    name: 'anthropic',
    generate: mockAnthropicGenerate,
  },
}));

// Mock do cache — passa-through quando nao chamado.
const { mockWithCache } = vi.hoisted(() => ({ mockWithCache: vi.fn() }));
vi.mock('@/lib/cache/redis-client', () => ({
  withCache: mockWithCache,
}));

// Mock do logger pra evitar spam de console.
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { generate } from '../index';

describe('generate — basico', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AI_CLASSIFICATION_PROVIDER;
    delete process.env.AI_CLASSIFICATION_MODEL;
    mockWithCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
  });

  it('encaminha pro provider Anthropic (task=classification default)', async () => {
    mockAnthropicGenerate.mockResolvedValue({
      text: 'ok', provider: 'anthropic', modelId: 'claude-haiku-4-5-20251001',
    });
    const result = await generate('classification', { messages: [{ role: 'user', content: 'hi' }] });
    expect(result.text).toBe('ok');
    expect(mockAnthropicGenerate).toHaveBeenCalledTimes(1);
    expect(mockGeminiGenerate).not.toHaveBeenCalled();
  });

  it('respeita provider override per-call', async () => {
    mockGeminiGenerate.mockResolvedValue({
      text: 'gemini-ok', provider: 'gemini', modelId: 'gemini-flash',
    });
    const result = await generate('classification', {
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'gemini',
    });
    expect(result.text).toBe('gemini-ok');
    expect(mockGeminiGenerate).toHaveBeenCalled();
    expect(mockAnthropicGenerate).not.toHaveBeenCalled();
  });
});

describe('generate — cache', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('NAO chama withCache quando req.cache ausente', async () => {
    mockAnthropicGenerate.mockResolvedValue({
      text: 'ok', provider: 'anthropic', modelId: 'm',
    });
    await generate('classification', { messages: [{ role: 'user', content: 'hi' }] });
    expect(mockWithCache).not.toHaveBeenCalled();
  });

  it('chama withCache com key + ttl quando req.cache presente', async () => {
    mockAnthropicGenerate.mockResolvedValue({
      text: 'ok', provider: 'anthropic', modelId: 'm',
    });
    mockWithCache.mockImplementation(async (key: string, fn: () => Promise<unknown>) => {
      expect(key).toBe('test-key');
      return fn();
    });
    await generate('classification', {
      messages: [{ role: 'user', content: 'hi' }],
      cache: { key: 'test-key', ttl: 60 },
    });
    expect(mockWithCache).toHaveBeenCalledTimes(1);
    expect(mockWithCache).toHaveBeenCalledWith('test-key', expect.any(Function), 60);
  });

  it('retorna resultado cacheado sem chamar provider novamente', async () => {
    const cachedResult = { text: 'from-cache', provider: 'anthropic' as const, modelId: 'm' };
    mockWithCache.mockResolvedValue(cachedResult);
    const result = await generate('classification', {
      messages: [{ role: 'user', content: 'hi' }],
      cache: { key: 'k', ttl: 60 },
    });
    expect(result).toBe(cachedResult);
    expect(mockAnthropicGenerate).not.toHaveBeenCalled();
  });
});

describe('generate — fallback cascade', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockWithCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
  });

  it('cascateia em 429 sustained (apos withRetry esgotar)', async () => {
    // withRetry tenta 3x em 429. Apos esgotar, cascade tenta fallback.
    // Aqui: primary sempre 429 (3 calls), fallback sucesso (1 call) = 4 total.
    mockAnthropicGenerate.mockImplementation(async (modelId: string) => {
      if (modelId === 'claude-fallback-1') {
        return { text: 'fallback-ok', provider: 'anthropic', modelId };
      }
      throw new Error('429 quota exceeded');
    });

    const result = await generate('classification', {
      messages: [{ role: 'user', content: 'x' }],
      fallbackModels: ['claude-fallback-1'],
    });

    expect(result.text).toBe('fallback-ok');
    // 3x primary (withRetry) + 1x fallback = 4 chamadas. Mas withRetry usa
    // delays — usa toHaveBeenCalled() para nao acoplar com timing.
    expect(mockAnthropicGenerate).toHaveBeenCalledWith('claude-haiku-4-5-20251001', expect.any(Object));
    expect(mockAnthropicGenerate).toHaveBeenCalledWith('claude-fallback-1', expect.any(Object));
  }, 30000); // timeout ample p/ retry delays

  it('cascateia em 404 model not found', async () => {
    mockAnthropicGenerate
      .mockRejectedValueOnce(new Error('404 model not found: claude-old'))
      .mockResolvedValueOnce({ text: 'ok', provider: 'anthropic', modelId: 'fb' });

    const result = await generate('classification', {
      messages: [{ role: 'user', content: 'x' }],
      model: 'claude-old',
      fallbackModels: ['claude-new'],
    });

    expect(result.text).toBe('ok');
    expect(mockAnthropicGenerate).toHaveBeenCalledTimes(2);
  });

  it('NAO cascateia em erro de safety/auth', async () => {
    mockAnthropicGenerate.mockRejectedValue(new Error('401 unauthorized'));
    await expect(
      generate('classification', {
        messages: [{ role: 'user', content: 'x' }],
        fallbackModels: ['claude-fb'],
      }),
    ).rejects.toThrow('401 unauthorized');
    // So tentou o primary; nao chegou no fallback.
    expect(mockAnthropicGenerate).toHaveBeenCalledTimes(1);
  });

  it('lanca o ultimo erro quando todos os fallbacks falham (404 nao-transient)', async () => {
    mockAnthropicGenerate.mockRejectedValue(new Error('404 model not found'));

    await expect(
      generate('classification', {
        messages: [{ role: 'user', content: 'x' }],
        model: 'm0',
        fallbackModels: ['fb1', 'fb2'],
      }),
    ).rejects.toThrow(/404/);
    // 404 nao-transient: withRetry nao retry, cascade tenta cada um 1x.
    // m0 + fb1 + fb2 = 3 chamadas.
    expect(mockAnthropicGenerate).toHaveBeenCalledTimes(3);
  });

  it('deduplica modelo principal do fallbackModels', async () => {
    mockAnthropicGenerate.mockImplementation(async (modelId: string) => {
      if (modelId === 'b') {
        return { text: 'fb', provider: 'anthropic', modelId };
      }
      throw new Error('404 model not found'); // nao-transient: cascade direto
    });

    await generate('classification', {
      messages: [{ role: 'user', content: 'x' }],
      model: 'a',
      fallbackModels: ['a', 'b'], // 'a' duplicado do model — deve ser ignorado
    });

    // 1x 'a' (404, withRetry nao retry) + 1x 'b' (sucesso) = 2 chamadas.
    expect(mockAnthropicGenerate).toHaveBeenCalledTimes(2);
    expect(mockAnthropicGenerate.mock.calls[0][0]).toBe('a');
    expect(mockAnthropicGenerate.mock.calls[1][0]).toBe('b');
  });
});

describe('generate — retry transient absorve 429 momentaneo', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockWithCache.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
  });

  it('withRetry recupera 429 momentaneo (sem cascade)', async () => {
    // 1x 429 + 1x success = withRetry catches, sem cascade.
    mockAnthropicGenerate
      .mockRejectedValueOnce(new Error('429 brief burst'))
      .mockResolvedValueOnce({ text: 'recovered', provider: 'anthropic', modelId: 'primary' });

    const result = await generate('classification', {
      messages: [{ role: 'user', content: 'x' }],
      fallbackModels: ['fb'],
    });

    expect(result.text).toBe('recovered');
    expect(mockAnthropicGenerate).toHaveBeenCalledTimes(2);
    // Ambas chamadas foram com o primary (cascade nao foi acionado).
    expect(mockAnthropicGenerate.mock.calls[0][0]).toBe('claude-haiku-4-5-20251001');
    expect(mockAnthropicGenerate.mock.calls[1][0]).toBe('claude-haiku-4-5-20251001');
  }, 10000);
});
