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

  it('após erro, próxima chamada com mesma key executa fn() fresh', async () => {
    // Primeira call: erro
    const failingFn = vi.fn(async () => {
      throw new Error('First call fails');
    });

    await expect(withCache('test:retry', failingFn, 60)).rejects.toThrow('First call fails');
    expect(failingFn).toHaveBeenCalledTimes(1);

    // Segunda call: sucesso (deve executar fresh)
    const successFn = vi.fn(async () => 100);
    const result = await withCache('test:retry', successFn, 60);

    expect(result).toBe(100);
    expect(successFn).toHaveBeenCalledTimes(1);
    expect(mockSetex).toHaveBeenCalledWith('test:retry', 60, 100);
  });

  it('singleFlight: false permite execução concorrente de fn() (escape hatch)', async () => {
    let count = 0;
    const fn = vi.fn(async () => {
      const myCount = ++count;
      // Yield para garantir intercalação
      await Promise.resolve();
      await Promise.resolve();
      return myCount;
    });

    // 3 callers concorrentes COM escape hatch
    const results = await Promise.all([
      withCache('test:no-sf', fn, 60, { singleFlight: false }),
      withCache('test:no-sf', fn, 60, { singleFlight: false }),
      withCache('test:no-sf', fn, 60, { singleFlight: false }),
    ]);

    // Sem single-flight: fn chamado 3x, cada um retorna seu próprio número
    expect(fn).toHaveBeenCalledTimes(3);
    expect(results).toEqual([1, 2, 3]);
  });

  it('emite warning Sentry quando inFlight.size >= MAX_IN_FLIGHT (amostrado)', async () => {
    // Mock Math.random para forçar amostragem (sempre dispara o warning quando atingir threshold)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.005); // < 0.01

    const { apiLogger } = await import('@/lib/logger');
    const Sentry = await import('@sentry/nextjs');

    // Bloquear todas as fn() retornadas para encher o Map
    const blockedPromises: ((v: unknown) => void)[] = [];
    const fn = vi.fn(() => new Promise<number>((resolve) => {
      blockedPromises.push(resolve as (v: unknown) => void);
    }));

    // Encher inFlight com 1001 entries para cruzar o threshold
    const callers: Promise<unknown>[] = [];
    for (let i = 0; i < 1001; i++) {
      callers.push(withCache(`test:leak:${i}`, fn, 60).catch(() => null));
    }

    // Micro-yield para registrar promises
    await Promise.resolve();
    await Promise.resolve();

    // Warning Sentry deve ter sido chamado ao menos 1x (com Math.random < 0.01 forçado)
    expect(apiLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        cache_in_flight_size: expect.any(Number),
        max: 1000,
      }),
      'cache.single_flight.high_water_mark',
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'cache.in_flight.exceeded_threshold',
      expect.objectContaining({
        level: 'warning',
        extra: expect.objectContaining({ max: 1000 }),
      }),
    );

    // Resolver todas para limpar
    for (const resolve of blockedPromises) resolve(0);
    await Promise.all(callers);

    randomSpy.mockRestore();
  });
});
