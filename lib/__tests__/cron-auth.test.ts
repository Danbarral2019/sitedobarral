// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { safeCompareSecret, verifyCronAuth } from '../cron-auth';

function req(authorization?: string) {
  return new NextRequest('http://localhost/api/cron/x', {
    headers: authorization ? { authorization } : {},
  });
}

describe('safeCompareSecret', () => {
  it('aceita segredo igual', () => {
    expect(safeCompareSecret('abc123', 'abc123')).toBe(true);
  });

  it('recusa segredo diferente, de outro tamanho ou ausente', () => {
    expect(safeCompareSecret('abc124', 'abc123')).toBe(false);
    expect(safeCompareSecret('abc', 'abc123')).toBe(false);
    expect(safeCompareSecret('abc1234567', 'abc123')).toBe(false);
    expect(safeCompareSecret(null, 'abc123')).toBe(false);
    expect(safeCompareSecret('', '')).toBe(false);
  });
});

describe('verifyCronAuth', () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = 'segredo-de-teste';
  });
  afterEach(() => {
    process.env.CRON_SECRET = original;
  });

  it('retorna null com Bearer correto', () => {
    expect(verifyCronAuth(req('Bearer segredo-de-teste'))).toBeNull();
  });

  it('retorna 401 sem header, com segredo errado ou sem prefixo Bearer', () => {
    expect(verifyCronAuth(req())?.status).toBe(401);
    expect(verifyCronAuth(req('Bearer errado'))?.status).toBe(401);
    expect(verifyCronAuth(req('segredo-de-teste'))?.status).toBe(401);
  });

  it('retorna 500 sem CRON_SECRET configurado', () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronAuth(req('Bearer x'))?.status).toBe(500);
  });
});
