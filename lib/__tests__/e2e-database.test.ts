import { describe, expect, it } from 'vitest';
import {
  E2E_STRIPE_OFFLINE_KEY,
  resolveE2EDatabaseUrl,
  resolveE2ERedisEnv,
  resolveE2EStripeSecretKey,
} from '../../e2e/fixtures/database';

// As URLs abaixo não levam usuário nem senha de propósito: a função decide
// apenas pelo hostname, e credencial em URI de teste é lida por scanner de
// segredo como vazamento. Não "complete" estas URLs para deixá-las realistas.
describe('resolveE2EDatabaseUrl', () => {
  it('aceita banco remoto somente pela variável explícita de teste', () => {
    const url = 'postgresql://example.neon.tech/neondb';

    expect(resolveE2EDatabaseUrl({ TEST_DATABASE_URL: url })).toBe(url);
  });

  it('aceita DATABASE_URL local', () => {
    const url = 'postgresql://postgres:postgres@localhost:5432/barral_e2e';

    expect(resolveE2EDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it('recusa DATABASE_URL remota para evitar uso acidental de produção', () => {
    const url = 'postgresql://database.example.com/site';

    expect(() => resolveE2EDatabaseUrl({ DATABASE_URL: url })).toThrow(
      'banco remoto deve ser informado exclusivamente por TEST_DATABASE_URL',
    );
  });
});

describe('resolveE2ERedisEnv', () => {
  it('sem emulador, devolve strings vazias para não herdar o Redis do .env.local', () => {
    expect(resolveE2ERedisEnv({})).toEqual({
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
    });
  });

  it('aceita emulador local', () => {
    expect(
      resolveE2ERedisEnv({
        E2E_UPSTASH_REDIS_REST_URL: 'http://127.0.0.1:8079',
        E2E_UPSTASH_REDIS_REST_TOKEN: 'token-local',
      }),
    ).toEqual({ UPSTASH_REDIS_REST_URL: 'http://127.0.0.1:8079', UPSTASH_REDIS_REST_TOKEN: 'token-local' });
  });

  it('recusa Redis remoto', () => {
    expect(() =>
      resolveE2ERedisEnv({ E2E_UPSTASH_REDIS_REST_URL: 'https://exemplo.upstash.io' }),
    ).toThrow('o Redis dos testes precisa ser local');
  });
});

describe('resolveE2EStripeSecretKey', () => {
  it('sem chave de teste, usa a chave fictícia que dispensa rede', () => {
    expect(resolveE2EStripeSecretKey(undefined)).toBe(E2E_STRIPE_OFFLINE_KEY);
    expect(resolveE2EStripeSecretKey('')).toBe(E2E_STRIPE_OFFLINE_KEY);
  });

  it('aceita chave de teste', () => {
    expect(resolveE2EStripeSecretKey('sk_test_abc')).toBe('sk_test_abc');
  });

  it('recusa qualquer chave que não seja de teste', () => {
    expect(() => resolveE2EStripeSecretKey('sk_live_abc')).toThrow('precisa ser chave de teste');
    expect(() => resolveE2EStripeSecretKey('rk_live_abc')).toThrow('precisa ser chave de teste');
  });
});
