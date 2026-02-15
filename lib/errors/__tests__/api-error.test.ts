/**
 * Testes para lib/errors/api-error.ts
 *
 * Testa as 8 classes de erro customizadas + helper isOperationalError.
 */

import { describe, it, expect } from 'vitest';
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
  isOperationalError,
} from '../api-error';

describe('api-error', () => {
  describe('ApiError (base)', () => {
    it('deve criar erro com todos os campos', () => {
      const err = new ApiError(400, 'Bad request', 'BAD_REQUEST', { field: 'x' });
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Bad request');
      expect(err.code).toBe('BAD_REQUEST');
      expect(err.details).toEqual({ field: 'x' });
      expect(err.isOperational).toBe(true);
      expect(err.name).toBe('ApiError');
      expect(err).toBeInstanceOf(Error);
    });

    it('deve ter stack trace', () => {
      const err = new ApiError(500, 'test');
      expect(err.stack).toBeDefined();
    });

    it('deve ser instanceof Error', () => {
      const err = new ApiError(400, 'test');
      expect(err instanceof Error).toBe(true);
      expect(err instanceof ApiError).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('deve ter status 400 e code VALIDATION_ERROR', () => {
      const err = new ValidationError('Campo inválido');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.name).toBe('ValidationError');
      expect(err.isOperational).toBe(true);
    });

    it('deve aceitar details', () => {
      const details = [{ field: 'email', message: 'Inválido' }];
      const err = new ValidationError('Dados inválidos', details);
      expect(err.details).toEqual(details);
    });
  });

  describe('AuthenticationError', () => {
    it('deve ter status 401 com mensagem padrão', () => {
      const err = new AuthenticationError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('AUTHENTICATION_ERROR');
      expect(err.name).toBe('AuthenticationError');
      expect(err.message).toContain('autenticado');
    });

    it('deve aceitar mensagem customizada', () => {
      const err = new AuthenticationError('Token expirado');
      expect(err.message).toBe('Token expirado');
    });
  });

  describe('AuthorizationError', () => {
    it('deve ter status 403 com mensagem padrão', () => {
      const err = new AuthorizationError();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('AUTHORIZATION_ERROR');
      expect(err.name).toBe('AuthorizationError');
      expect(err.message).toContain('permissão');
    });

    it('deve aceitar mensagem customizada', () => {
      const err = new AuthorizationError('Apenas admins');
      expect(err.message).toBe('Apenas admins');
    });
  });

  describe('NotFoundError', () => {
    it('deve ter status 404 com nome do recurso', () => {
      const err = new NotFoundError('Documento');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.name).toBe('NotFoundError');
      expect(err.message).toBe('Documento não encontrado');
    });

    it('deve formatar mensagem com recurso customizado', () => {
      const err = new NotFoundError('Usuário');
      expect(err.message).toBe('Usuário não encontrado');
    });
  });

  describe('ConflictError', () => {
    it('deve ter status 409', () => {
      const err = new ConflictError('Email já cadastrado');
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
      expect(err.name).toBe('ConflictError');
    });

    it('deve aceitar details', () => {
      const err = new ConflictError('Duplicado', { field: 'email' });
      expect(err.details).toEqual({ field: 'email' });
    });
  });

  describe('RateLimitError', () => {
    it('deve ter status 429 com mensagem padrão', () => {
      const err = new RateLimitError();
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(err.name).toBe('RateLimitError');
      expect(err.message).toContain('requisições');
    });

    it('deve incluir retryAfter nos details', () => {
      const err = new RateLimitError('Limite excedido', 60);
      expect(err.details).toEqual({ retryAfter: 60 });
    });
  });

  describe('InternalServerError', () => {
    it('deve ter status 500 e isOperational false', () => {
      const err = new InternalServerError();
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_SERVER_ERROR');
      expect(err.name).toBe('InternalServerError');
      expect(err.isOperational).toBe(false);
    });

    it('deve incluir erro original nos details', () => {
      const original = new Error('DB connection failed');
      const err = new InternalServerError('Falha interna', original);
      expect(err.details).toEqual(expect.objectContaining({
        message: 'DB connection failed',
      }));
    });
  });

  describe('ServiceUnavailableError', () => {
    it('deve ter status 503 com nome do serviço', () => {
      const err = new ServiceUnavailableError('Database');
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe('SERVICE_UNAVAILABLE');
      expect(err.name).toBe('ServiceUnavailableError');
      expect(err.message).toContain('Database');
    });

    it('deve aceitar mensagem customizada', () => {
      const err = new ServiceUnavailableError('Redis', 'Cache indisponível');
      expect(err.message).toBe('Cache indisponível');
      expect(err.details).toEqual({ service: 'Redis' });
    });
  });

  describe('isOperationalError', () => {
    it('deve retornar true para erros operacionais', () => {
      expect(isOperationalError(new ValidationError('test'))).toBe(true);
      expect(isOperationalError(new AuthenticationError())).toBe(true);
      expect(isOperationalError(new NotFoundError('x'))).toBe(true);
      expect(isOperationalError(new RateLimitError())).toBe(true);
    });

    it('deve retornar false para InternalServerError', () => {
      expect(isOperationalError(new InternalServerError())).toBe(false);
    });

    it('deve retornar false para erros genéricos', () => {
      expect(isOperationalError(new Error('generic'))).toBe(false);
    });

    it('deve retornar false para TypeError', () => {
      expect(isOperationalError(new TypeError('type error'))).toBe(false);
    });
  });
});
