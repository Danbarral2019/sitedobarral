/**
 * Testes para lib/rate-limit.ts
 *
 * Testa RateLimiter, factory e headers helper.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, rateLimit, addRateLimitHeaders } from '../rate-limit';
import { NextRequest, NextResponse } from 'next/server';

// Helper para criar NextRequest com headers customizados
function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const h = new Headers(headers);
  return new NextRequest('http://localhost:3000/api/test', { headers: h });
}

describe('rate-limit', () => {
  describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter({ interval: 60000, uniqueTokenPerInterval: 100 });
    });

    it('deve permitir primeira requisição', async () => {
      const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
      await expect(limiter.check(req, 10)).resolves.toBeUndefined();
    });

    it('deve permitir múltiplas requisições dentro do limite', async () => {
      const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
      for (let i = 0; i < 5; i++) {
        await expect(limiter.check(req, 10)).resolves.toBeUndefined();
      }
    });

    it('deve lançar erro ao exceder limite', async () => {
      const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
      // Usa limite de 3
      for (let i = 0; i < 3; i++) {
        await limiter.check(req, 3);
      }
      await expect(limiter.check(req, 3)).rejects.toThrow('Rate limit exceeded');
    });

    it('deve extrair IP do x-forwarded-for', async () => {
      const req1 = makeRequest({ 'x-forwarded-for': '10.0.0.1' });
      const req2 = makeRequest({ 'x-forwarded-for': '10.0.0.2' });

      // Esgota limite do IP 1
      for (let i = 0; i < 2; i++) {
        await limiter.check(req1, 2);
      }

      // IP 2 deve funcionar
      await expect(limiter.check(req2, 2)).resolves.toBeUndefined();
    });

    it('deve extrair IP do x-real-ip como fallback', async () => {
      const req = makeRequest({ 'x-real-ip': '192.168.1.1' });
      await expect(limiter.check(req, 10)).resolves.toBeUndefined();
    });

    it('deve usar "unknown" quando não há IP', async () => {
      const req = makeRequest();
      await expect(limiter.check(req, 10)).resolves.toBeUndefined();
    });

    it('deve extrair primeiro IP de x-forwarded-for com múltiplos', async () => {
      const req1 = makeRequest({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' });
      const req2 = makeRequest({ 'x-forwarded-for': '1.1.1.1, 3.3.3.3' });

      // Ambos devem contar como mesmo IP (1.1.1.1)
      await limiter.check(req1, 2);
      await limiter.check(req2, 2);
      await expect(limiter.check(req1, 2)).rejects.toThrow();
    });

    it('deve resetar após intervalo', async () => {
      vi.useFakeTimers();
      const limiterShort = new RateLimiter({ interval: 1000 });
      const req = makeRequest({ 'x-forwarded-for': '5.5.5.5' });

      await limiterShort.check(req, 1);
      await expect(limiterShort.check(req, 1)).rejects.toThrow();

      // Avança 2 segundos
      vi.advanceTimersByTime(2000);

      // Deve funcionar novamente
      await expect(limiterShort.check(req, 1)).resolves.toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('RateLimiter.getStatus', () => {
    it('deve retornar remaining = limit para novo IP', async () => {
      const limiter = new RateLimiter({ interval: 60000 });
      const req = makeRequest({ 'x-forwarded-for': '9.9.9.9' });

      const status = await limiter.getStatus(req, 10);
      expect(status.remaining).toBe(10);
      expect(status.resetIn).toBeGreaterThan(0);
    });

    it('deve decrementar remaining após check', async () => {
      const limiter = new RateLimiter({ interval: 60000 });
      const req = makeRequest({ 'x-forwarded-for': '8.8.8.8' });

      await limiter.check(req, 10);
      await limiter.check(req, 10);

      const status = await limiter.getStatus(req, 10);
      expect(status.remaining).toBe(8);
    });

    it('deve retornar remaining 0 quando excedido', async () => {
      const limiter = new RateLimiter({ interval: 60000 });
      const req = makeRequest({ 'x-forwarded-for': '7.7.7.7' });

      for (let i = 0; i < 5; i++) {
        await limiter.check(req, 5);
      }

      const status = await limiter.getStatus(req, 5);
      expect(status.remaining).toBe(0);
    });
  });

  describe('rateLimit factory', () => {
    it('deve criar instância de RateLimiter', () => {
      const limiter = rateLimit();
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('deve aceitar opções customizadas', () => {
      const limiter = rateLimit({ interval: 30000 });
      expect(limiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('addRateLimitHeaders', () => {
    it('deve adicionar headers de rate limit na resposta', () => {
      const response = NextResponse.json({ ok: true });
      const result = addRateLimitHeaders(response, 100, 95, 60);

      expect(result.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(result.headers.get('X-RateLimit-Remaining')).toBe('95');
      expect(result.headers.get('X-RateLimit-Reset')).toBe('60');
    });

    it('deve retornar o mesmo objeto response', () => {
      const response = NextResponse.json({ ok: true });
      const result = addRateLimitHeaders(response, 10, 5, 30);
      expect(result).toBe(response);
    });
  });
});
