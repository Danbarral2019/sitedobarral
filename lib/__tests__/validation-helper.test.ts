/**
 * Testes para lib/validation-helper.ts
 *
 * Testa validateRequest, validateQueryParams e formatZodError.
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { validateRequest, validateQueryParams, formatZodError } from '../validation-helper';
import { ZodError } from 'zod';

const testSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().optional(),
});

function makeJsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('validation-helper', () => {
  describe('validateRequest', () => {
    it('deve validar body válido com sucesso', async () => {
      const req = makeJsonRequest({ name: 'Daniel', email: 'dan@test.com' });
      const result = await validateRequest(req, testSchema);

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ name: 'Daniel', email: 'dan@test.com' });
    });

    it('deve retornar erro 400 para body inválido', async () => {
      const req = makeJsonRequest({ name: '', email: 'not-email' });
      const result = await validateRequest(req, testSchema);

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error!.status).toBe(400);
    });

    it('deve retornar erro 400 para JSON inválido', async () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{{{',
      });
      const result = await validateRequest(req, testSchema);

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error!.status).toBe(400);
    });

    it('deve incluir detalhes dos erros de validação', async () => {
      const req = makeJsonRequest({ name: 'Daniel' }); // sem email
      const result = await validateRequest(req, testSchema);

      expect(result.error).not.toBeNull();
      const body = await result.error!.json();
      expect(body.error).toBe('Dados inválidos');
      expect(body.details).toBeDefined();
      expect(Array.isArray(body.details)).toBe(true);
    });
  });

  describe('validateQueryParams', () => {
    const querySchema = z.object({
      page: z.string().optional(),
      category: z.string().optional(),
    });

    it('deve validar query params válidos', () => {
      const params = new URLSearchParams({ page: '1', category: 'apostila' });
      const result = validateQueryParams(params, querySchema);

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ page: '1', category: 'apostila' });
    });

    it('deve retornar erro para params inválidos', () => {
      const strictSchema = z.object({ page: z.string().regex(/^\d+$/) });
      const params = new URLSearchParams({ page: 'abc' });
      const result = validateQueryParams(params, strictSchema);

      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error!.status).toBe(400);
    });
  });

  describe('formatZodError', () => {
    it('deve formatar issues do Zod em objeto field→message', () => {
      const result = testSchema.safeParse({ name: '', email: 'invalid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const formatted = formatZodError(result.error);
        expect(typeof formatted).toBe('object');
        // Deve ter pelo menos um campo com erro
        expect(Object.keys(formatted).length).toBeGreaterThan(0);
      }
    });

    it('deve usar path concatenado como chave', () => {
      const nestedSchema = z.object({ address: z.object({ city: z.string() }) });
      const result = nestedSchema.safeParse({ address: { city: 123 } });
      if (!result.success) {
        const formatted = formatZodError(result.error);
        expect(formatted['address.city']).toBeDefined();
      }
    });
  });
});
