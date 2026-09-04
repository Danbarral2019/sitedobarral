/**
 * Testes do modo "cache desabilitado" de lib/cache/redis-client.ts.
 *
 * Sem UPSTASH_REDIS_REST_URL/TOKEN o cliente `redis` é null. Todas as
 * funções devem degradar graciosamente (fail-open) sem lançar — importante
 * em dev e em incidente (Upstash fora). Arquivo separado porque o cliente
 * é resolvido uma única vez no import, a partir do env.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Garante que as env vars do Redis NÃO estejam presentes antes do import.
vi.hoisted(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

import {
  redis,
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  existsCache,
  incrementCache,
  checkRateLimit,
  registerCacheKey,
  getRegisteredKeys,
  invalidateCacheByPrefix,
  withCache,
  healthCheck,
  isCacheEnabled,
  CacheInvalidation,
} from '../redis-client';

describe('redis-client — modo desabilitado (redis = null)', () => {
  beforeAll(() => {
    expect(redis).toBeNull();
  });

  it('isCacheEnabled retorna false', () => {
    expect(isCacheEnabled()).toBe(false);
  });

  it('leituras/escritas degradam sem lançar', async () => {
    expect(await getCache('k')).toBeNull();
    await expect(setCache('k', { a: 1 })).resolves.toBeUndefined();
    await expect(deleteCache('k')).resolves.toBeUndefined();
    expect(await deleteCachePattern('k:*')).toBe(0);
    expect(await existsCache('k')).toBe(false);
    expect(await incrementCache('k')).toBe(0);
  });

  it('checkRateLimit falha aberto (allowed=true, remaining=limit)', async () => {
    const r = await checkRateLimit('user', 10, 60);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(10);
    expect(r.limit).toBe(10);
  });

  it('checkRateLimit falha fechado quando Redis está indisponível e o controle é sensível', async () => {
    const r = await checkRateLimit('login:user', 5, 60, { failureMode: 'closed' });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.limit).toBe(5);
  });

  it('registry degrada para no-op / vazio', async () => {
    await expect(registerCacheKey('faq', 'faq:1')).resolves.toBeUndefined();
    expect(await getRegisteredKeys('faq')).toEqual([]);
    expect(await invalidateCacheByPrefix('faq')).toBe(0);
    expect(await CacheInvalidation.leiArticle('75')).toBe(0);
  });

  it('withCache executa o fetcher diretamente (sem cachear)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const out = await withCache('k', fetcher, 60);
    expect(out).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('healthCheck reporta desconectado', async () => {
    const h = await healthCheck();
    expect(h.connected).toBe(false);
  });
});
