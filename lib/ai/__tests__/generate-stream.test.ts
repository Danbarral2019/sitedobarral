/**
 * Tests do generateStream() — encaminhamento ao provider, fallback na
 * INICIACAO, erro quando provider nao suporta streaming.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGeminiGenerateStream, mockAnthropicGenerateStream } = vi.hoisted(() => ({
  mockGeminiGenerateStream: vi.fn(),
  mockAnthropicGenerateStream: vi.fn(),
}));

vi.mock('../providers/gemini', () => ({
  geminiProvider: {
    name: 'gemini',
    generate: vi.fn(),
    generateStream: mockGeminiGenerateStream,
  },
}));

vi.mock('../providers/anthropic', () => ({
  anthropicProvider: {
    name: 'anthropic',
    generate: vi.fn(),
    generateStream: mockAnthropicGenerateStream,
  },
}));

vi.mock('@/lib/cache/redis-client', () => ({ withCache: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

import { generateStream } from '../index';

async function* fakeChunks() {
  yield { text: 'hello ', provider: 'gemini' as const, modelId: 'gemini-flash' };
  yield { text: 'world', provider: 'gemini' as const, modelId: 'gemini-flash' };
  yield {
    finishReason: 'STOP',
    usage: { inputTokens: 5, outputTokens: 2 },
    provider: 'gemini' as const,
    modelId: 'gemini-flash',
  };
}

describe('generateStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('encaminha pra Gemini quando task=chat (default gemini)', async () => {
    mockGeminiGenerateStream.mockResolvedValue(fakeChunks());

    const stream = await generateStream('chat', { messages: [{ role: 'user', content: 'oi' }] });
    const collected: Array<{ text?: string; finishReason?: string }> = [];
    for await (const chunk of stream) {
      collected.push({ text: chunk.text, finishReason: chunk.finishReason });
    }

    expect(collected).toEqual([
      { text: 'hello ' },
      { text: 'world' },
      { finishReason: 'STOP' },
    ]);
    expect(mockGeminiGenerateStream).toHaveBeenCalledTimes(1);
  });

  it('cascateia INICIACAO em 429', async () => {
    mockGeminiGenerateStream
      .mockRejectedValueOnce(new Error('429 quota'))
      .mockResolvedValueOnce(fakeChunks());

    const stream = await generateStream('chat', {
      messages: [{ role: 'user', content: 'x' }],
      fallbackModels: ['gemini-flash-fb'],
    });
    let texts = '';
    for await (const chunk of stream) {
      if (chunk.text) texts += chunk.text;
    }
    expect(texts).toBe('hello world');
    expect(mockGeminiGenerateStream).toHaveBeenCalledTimes(2);
  });

  it('lanca erro quando provider nao tem generateStream', async () => {
    // Re-importa com mock que nao expoe generateStream.
    vi.resetModules();
    vi.doMock('../providers/anthropic', () => ({
      anthropicProvider: { name: 'anthropic', generate: vi.fn() }, // sem generateStream
    }));
    vi.doMock('../providers/gemini', () => ({
      geminiProvider: { name: 'gemini', generate: vi.fn() }, // sem generateStream
    }));
    vi.doMock('@/lib/cache/redis-client', () => ({ withCache: vi.fn() }));
    vi.doMock('@/lib/logger', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
    }));
    const { generateStream: gs } = await import('../index');
    await expect(
      gs('chat', { messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow(/does not support streaming/);
  });
});
