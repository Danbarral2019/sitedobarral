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

  it('de-duplica 3 callers concorrentes para a mesma key (fn chamado 1 vez)', async () => {
    let resolveFn: (value: number) => void = () => {};
    const fn = vi.fn(() => new Promise<number>((resolve) => {
      resolveFn = resolve;
    }));

    // Dispara 3 callers concorrentes
    const a = withCache('test:stampede', fn, 60);
    const b = withCache('test:stampede', fn, 60);
    const c = withCache('test:stampede', fn, 60);

    // Micro-yield para garantir que todas as 3 promises registraram
    await Promise.resolve();
    await Promise.resolve();

    // fn() ainda não resolveu — fn deve ter sido chamado apenas 1 vez
    expect(fn).toHaveBeenCalledTimes(1);

    // Resolve fn()
    resolveFn(42);

    // Todos os 3 awaiters recebem o mesmo valor
    expect(await a).toBe(42);
    expect(await b).toBe(42);
    expect(await c).toBe(42);

    // setCache chamado apenas 1 vez (única execução de fn)
    expect(mockSetex).toHaveBeenCalledTimes(1);
    expect(mockSetex).toHaveBeenCalledWith('test:stampede', 60, 42);

    // fn ainda só chamado 1 vez
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('erro em fn() é propagado para todos os awaiters e não polui cache', async () => {
    const originalError = new Error('Gemini timeout');
    let rejectFn: (err: Error) => void = () => {};
    const fn = vi.fn(() => new Promise<number>((_resolve, reject) => {
      rejectFn = reject;
    }));

    // 2 callers concorrentes
    const a = withCache('test:error', fn, 60).catch((e) => e);
    const b = withCache('test:error', fn, 60).catch((e) => e);

    await Promise.resolve();
    await Promise.resolve();

    rejectFn(originalError);

    const resultA = await a;
    const resultB = await b;

    // Ambos recebem o mesmo erro original (mesma instância)
    expect(resultA).toBe(originalError);
    expect(resultB).toBe(originalError);

    // fn() chamado apenas 1 vez (single-flight ativo)
    expect(fn).toHaveBeenCalledTimes(1);

    // setCache NÃO foi chamado (erro impede)
    expect(mockSetex).not.toHaveBeenCalled();
  });
});
