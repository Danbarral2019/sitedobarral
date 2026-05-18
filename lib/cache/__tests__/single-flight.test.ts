// @vitest-environment node
/**
 * Testes para single-flight de-duplication em withCache.
 * Cobre dedup in-memory de chamadas concorrentes para a mesma key.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token-123';
});

const mockGet = vi.hoisted(() => vi.fn());
const mockSetex = vi.hoisted(() => vi.fn());

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    get = mockGet;
    setex = mockSetex;
    // Métodos não usados nestes testes mas chamados internamente — stubs no-op
    sadd = vi.fn();
    smembers = vi.fn();
    del = vi.fn();
    exists = vi.fn();
    incr = vi.fn();
    expire = vi.fn();
    ping = vi.fn();
  },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

import { withCache, __resetInFlightForTesting } from '@/lib/cache/redis-client';

describe('withCache single-flight', () => {
  beforeEach(() => {
    __resetInFlightForTesting();
    vi.clearAllMocks();
    mockGet.mockResolvedValue(null); // default: cache miss
    mockSetex.mockResolvedValue('OK');
  });

  it('caller único executa fn() uma vez e retorna o resultado', async () => {
    const fn = vi.fn(async () => 42);
    const result = await withCache('test:single', fn, 60);

    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockSetex).toHaveBeenCalledWith('test:single', 60, 42);
  });
});
