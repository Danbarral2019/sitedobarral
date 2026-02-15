/**
 * Testes para lib/errors/error-handler.ts
 *
 * Testa handleApiError e withErrorHandler.
 */

import { describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { ZodError, ZodIssue } from 'zod';
import { Prisma } from '@prisma/client';
import { handleApiError, withErrorHandler } from '../error-handler';
import {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
} from '../api-error';

// Helper para extrair body JSON da NextResponse
async function getResponseBody(response: NextResponse): Promise<Record<string, unknown>> {
  const text = await response.text();
  return JSON.parse(text);
}

describe('error-handler', () => {
  describe('handleApiError — ApiError subclasses', () => {
    it('deve retornar 400 para ValidationError', async () => {
      const response = handleApiError(new ValidationError('Campo inválido'));
      expect(response.status).toBe(400);
      const body = await getResponseBody(response);
      expect(body.error).toBe('Campo inválido');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.timestamp).toBeDefined();
    });

    it('deve retornar 401 para AuthenticationError', async () => {
      const response = handleApiError(new AuthenticationError());
      expect(response.status).toBe(401);
      const body = await getResponseBody(response);
      expect(body.code).toBe('AUTHENTICATION_ERROR');
    });

    it('deve retornar 403 para AuthorizationError', async () => {
      const response = handleApiError(new AuthorizationError());
      expect(response.status).toBe(403);
      const body = await getResponseBody(response);
      expect(body.code).toBe('AUTHORIZATION_ERROR');
    });

    it('deve retornar 404 para NotFoundError', async () => {
      const response = handleApiError(new NotFoundError('Documento'));
      expect(response.status).toBe(404);
      const body = await getResponseBody(response);
      expect(body.error).toBe('Documento não encontrado');
      expect(body.code).toBe('NOT_FOUND');
    });

    it('deve retornar 409 para ConflictError', async () => {
      const response = handleApiError(new ConflictError('Email duplicado'));
      expect(response.status).toBe(409);
      const body = await getResponseBody(response);
      expect(body.error).toBe('Email duplicado');
      expect(body.code).toBe('CONFLICT');
    });

    it('deve retornar 429 para RateLimitError', async () => {
      const response = handleApiError(new RateLimitError('Limite', 30));
      expect(response.status).toBe(429);
      const body = await getResponseBody(response);
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.details).toEqual({ retryAfter: 30 });
    });

    it('deve retornar 500 para InternalServerError', async () => {
      const response = handleApiError(new InternalServerError());
      expect(response.status).toBe(500);
      const body = await getResponseBody(response);
      expect(body.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('deve retornar 503 para ServiceUnavailableError', async () => {
      const response = handleApiError(new ServiceUnavailableError('Database'));
      expect(response.status).toBe(503);
      const body = await getResponseBody(response);
      expect(body.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('deve incluir details quando presente', async () => {
      const details = [{ field: 'email', message: 'obrigatório' }];
      const response = handleApiError(new ValidationError('Inválido', details));
      const body = await getResponseBody(response);
      expect(body.details).toEqual(details);
    });
  });

  describe('handleApiError — ZodError', () => {
    it('deve retornar 400 para ZodError', async () => {
      const issues: ZodIssue[] = [{
        code: 'invalid_type',
        expected: 'string',
        path: ['email'],
        message: 'Expected string, received number',
      } as ZodIssue];
      const zodError = new ZodError(issues);

      const response = handleApiError(zodError);
      expect(response.status).toBe(400);

      const body = await getResponseBody(response);
      expect(body.error).toBe('Dados inválidos');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.details)).toBe(true);
      const details = body.details as Array<{ field: string; message: string }>;
      expect(details[0].field).toBe('email');
    });

    it('deve formatar múltiplos issues do Zod', async () => {
      const issues: ZodIssue[] = [
        { code: 'invalid_type', expected: 'string', path: ['name'], message: 'Required' } as ZodIssue,
        { code: 'invalid_type', expected: 'string', path: ['email'], message: 'Not a string' } as ZodIssue,
      ];
      const zodError = new ZodError(issues);

      const response = handleApiError(zodError);
      const body = await getResponseBody(response);
      const details = body.details as Array<{ field: string }>;
      expect(details).toHaveLength(2);
    });
  });

  describe('handleApiError — Prisma errors', () => {
    it('deve retornar 409 para P2002 (unique constraint)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', meta: { target: ['email'] }, clientVersion: '5.0.0' }
      );

      const response = handleApiError(prismaError);
      expect(response.status).toBe(409);
      const body = await getResponseBody(response);
      expect(body.code).toBe('DUPLICATE_ENTRY');
      expect(body.error).toContain('email');
    });

    it('deve retornar 404 para P2025 (record not found)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' }
      );

      const response = handleApiError(prismaError);
      expect(response.status).toBe(404);
      const body = await getResponseBody(response);
      expect(body.code).toBe('NOT_FOUND');
    });

    it('deve retornar 400 para P2003 (foreign key)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', meta: { field_name: 'courseId' }, clientVersion: '5.0.0' }
      );

      const response = handleApiError(prismaError);
      expect(response.status).toBe(400);
      const body = await getResponseBody(response);
      expect(body.code).toBe('FOREIGN_KEY_VIOLATION');
    });

    it('deve retornar 409 para P2014 (relation violation)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Relation violation',
        { code: 'P2014', clientVersion: '5.0.0' }
      );

      const response = handleApiError(prismaError);
      expect(response.status).toBe(409);
      const body = await getResponseBody(response);
      expect(body.code).toBe('RELATION_VIOLATION');
    });

    it('deve retornar 503 para P2024 (connection timeout)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Connection pool timeout',
        { code: 'P2024', clientVersion: '5.0.0' }
      );

      const response = handleApiError(prismaError);
      expect(response.status).toBe(503);
      const body = await getResponseBody(response);
      expect(body.code).toBe('DATABASE_TIMEOUT');
    });

    it('deve retornar 503 para P1001 (database unreachable)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Can\'t reach database',
        { code: 'P1001', clientVersion: '5.0.0' }
      );

      const response = handleApiError(prismaError);
      expect(response.status).toBe(503);
      const body = await getResponseBody(response);
      expect(body.code).toBe('DATABASE_UNREACHABLE');
    });

    it('deve retornar 503 para P1017 (connection closed)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Connection closed',
        { code: 'P1017', clientVersion: '5.0.0' }
      );

      const response = handleApiError(prismaError);
      expect(response.status).toBe(503);
      const body = await getResponseBody(response);
      expect(body.code).toBe('DATABASE_CONNECTION_LOST');
    });

    it('deve retornar 500 para código Prisma desconhecido', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unknown error',
        { code: 'P9999', clientVersion: '5.0.0' }
      );

      const response = handleApiError(prismaError);
      expect(response.status).toBe(500);
      const body = await getResponseBody(response);
      expect(body.code).toBe('DATABASE_ERROR');
    });
  });

  describe('handleApiError — JWT errors', () => {
    it('deve retornar 401 para JWT expirado', async () => {
      const jwtError = new Error('Token expired');
      jwtError.name = 'JWTExpired';

      const response = handleApiError(jwtError);
      expect(response.status).toBe(401);
      const body = await getResponseBody(response);
      expect(body.code).toBe('TOKEN_EXPIRED');
    });

    it('deve retornar 401 para JWT inválido', async () => {
      const jwtError = new Error('Invalid JWT');
      jwtError.name = 'JWTInvalid';

      const response = handleApiError(jwtError);
      expect(response.status).toBe(401);
      const body = await getResponseBody(response);
      expect(body.code).toBe('TOKEN_INVALID');
    });

    it('deve retornar 401 para JWS inválido', async () => {
      const jwsError = new Error('Invalid signature');
      jwsError.name = 'JWSInvalid';

      const response = handleApiError(jwsError);
      expect(response.status).toBe(401);
      const body = await getResponseBody(response);
      expect(body.code).toBe('TOKEN_INVALID');
    });

    it('deve retornar 401 para JWT claim validation failed', async () => {
      const claimError = new Error('Claim validation failed');
      claimError.name = 'JWTClaimValidationFailed';

      const response = handleApiError(claimError);
      expect(response.status).toBe(401);
      const body = await getResponseBody(response);
      expect(body.code).toBe('TOKEN_CLAIM_INVALID');
    });

    it('deve retornar 401 para erro com mensagem contendo "exp"', async () => {
      const response = handleApiError(new Error('exp claim invalid'));
      expect(response.status).toBe(401);
      const body = await getResponseBody(response);
      expect(body.code).toBe('TOKEN_EXPIRED');
    });

    it('deve retornar 401 para erro com mensagem contendo "signature"', async () => {
      const response = handleApiError(new Error('Invalid signature verification'));
      expect(response.status).toBe(401);
      const body = await getResponseBody(response);
      expect(body.code).toBe('TOKEN_INVALID');
    });
  });

  describe('handleApiError — Erros genéricos', () => {
    it('deve retornar 500 para Error genérico', async () => {
      const response = handleApiError(new Error('Algo deu errado'));
      expect(response.status).toBe(500);
      const body = await getResponseBody(response);
      expect(body.error).toBe('Erro interno do servidor');
      expect(body.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('deve retornar 500 para string', async () => {
      const response = handleApiError('string error');
      expect(response.status).toBe(500);
    });

    it('deve retornar 500 para null', async () => {
      const response = handleApiError(null);
      expect(response.status).toBe(500);
    });

    it('deve incluir timestamp', async () => {
      const response = handleApiError(new Error('test'));
      const body = await getResponseBody(response);
      expect(body.timestamp).toBeDefined();
      // Verifica formato ISO
      expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
    });
  });

  describe('withErrorHandler', () => {
    it('deve retornar resposta normal quando handler não lança erro', async () => {
      const handler = vi.fn().mockResolvedValue(
        NextResponse.json({ ok: true })
      );
      const wrapped = withErrorHandler(handler);
      const response = await wrapped();

      expect(response.status).toBe(200);
    });

    it('deve capturar erro e retornar resposta de erro', async () => {
      const handler = vi.fn().mockRejectedValue(new NotFoundError('Item'));
      const wrapped = withErrorHandler(handler);
      const response = await wrapped();

      expect(response.status).toBe(404);
    });

    it('deve capturar erros genéricos', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Crash'));
      const wrapped = withErrorHandler(handler);
      const response = await wrapped();

      expect(response.status).toBe(500);
    });
  });
});
