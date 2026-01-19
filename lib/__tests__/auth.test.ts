/**
 * Testes para lib/auth.ts
 *
 * Testa validação de payload JWT com schema Zod.
 * Os testes de geração/verificação de token são testados via integração
 * pois a biblioteca jose requer ambiente Web Crypto.
 */

import { describe, it, expect, vi } from 'vitest';
import { AuthPayloadSchema } from '../auth';

// Mock da biblioteca jose para testes unitários
vi.mock('jose', () => {
  // Mock class para SignJWT
  class MockSignJWT {
    private _payload: Record<string, unknown>;
    constructor(payload: Record<string, unknown>) {
      this._payload = payload;
    }
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return 'mock.jwt.token'; }
  }

  return {
    SignJWT: MockSignJWT,
    jwtVerify: vi.fn().mockImplementation(async (token: string) => {
      if (token === 'mock.jwt.token' || token.startsWith('valid.')) {
        return {
          payload: {
            userId: 'user-123',
            role: 'student',
            courseId: 'course-1',
          },
        };
      }
      throw new Error('Invalid token');
    }),
  };
});

describe('Auth Module', () => {
  // Payload válido para testes
  const validPayload = {
    userId: 'user-123',
    role: 'student' as const,
    courseId: 'course-1',
  };

  const adminPayload = {
    userId: 'admin-456',
    role: 'admin' as const,
  };

  describe('AuthPayloadSchema - Validação de Payload', () => {
    it('deve validar payload válido de estudante', () => {
      const result = AuthPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('deve validar payload válido de admin', () => {
      const result = AuthPayloadSchema.safeParse(adminPayload);
      expect(result.success).toBe(true);
    });

    it('deve rejeitar payload sem userId', () => {
      const result = AuthPayloadSchema.safeParse({
        role: 'student',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar payload com userId vazio', () => {
      const result = AuthPayloadSchema.safeParse({
        userId: '',
        role: 'student',
      });
      expect(result.success).toBe(false);
    });

    it('deve rejeitar payload com role inválido', () => {
      const result = AuthPayloadSchema.safeParse({
        userId: 'user-123',
        role: 'superuser', // role inválido
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar payload com validUntil em formato ISO', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 dia
      const result = AuthPayloadSchema.safeParse({
        userId: 'user-123',
        role: 'student',
        validUntil: futureDate,
      });
      expect(result.success).toBe(true);
    });

    it('deve rejeitar validUntil em formato inválido', () => {
      const result = AuthPayloadSchema.safeParse({
        userId: 'user-123',
        role: 'student',
        validUntil: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('deve aceitar role admin', () => {
      const result = AuthPayloadSchema.safeParse({
        userId: 'admin-123',
        role: 'admin',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('admin');
      }
    });

    it('deve aceitar role student', () => {
      const result = AuthPayloadSchema.safeParse({
        userId: 'student-123',
        role: 'student',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('student');
      }
    });

    it('deve aceitar courseId opcional', () => {
      const withCourse = AuthPayloadSchema.safeParse({
        userId: 'user-123',
        role: 'student',
        courseId: 'course-5',
      });
      expect(withCourse.success).toBe(true);
      if (withCourse.success) {
        expect(withCourse.data.courseId).toBe('course-5');
      }

      const withoutCourse = AuthPayloadSchema.safeParse({
        userId: 'user-123',
        role: 'student',
      });
      expect(withoutCourse.success).toBe(true);
      if (withoutCourse.success) {
        expect(withoutCourse.data.courseId).toBeUndefined();
      }
    });

    it('deve aceitar turma opcional', () => {
      const result = AuthPayloadSchema.safeParse({
        userId: 'user-123',
        role: 'student',
        turma: 'Turma 2024.1',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.turma).toBe('Turma 2024.1');
      }
    });

    it('deve preservar todos os campos válidos', () => {
      const fullPayload = {
        userId: 'user-789',
        role: 'student' as const,
        courseId: 'course-3',
        turma: 'Turma 2024/1 - Noturno',
        validUntil: '2024-12-31T23:59:59.999Z',
      };

      const result = AuthPayloadSchema.safeParse(fullPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(fullPayload);
      }
    });
  });

  describe('AuthPayloadSchema - Edge Cases', () => {
    it('deve lidar com userId muito longo', () => {
      const longUserId = 'u'.repeat(1000);
      const result = AuthPayloadSchema.safeParse({
        userId: longUserId,
        role: 'student',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(longUserId);
      }
    });

    it('deve lidar com caracteres especiais no userId', () => {
      const specialUserId = 'user-123_test@domain.com';
      const result = AuthPayloadSchema.safeParse({
        userId: specialUserId,
        role: 'admin',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(specialUserId);
      }
    });

    it('deve lidar com turma contendo caracteres especiais', () => {
      const result = AuthPayloadSchema.safeParse({
        userId: 'user-123',
        role: 'student',
        turma: 'Turma 2024/1 - Noturno (Extensão)',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.turma).toBe('Turma 2024/1 - Noturno (Extensão)');
      }
    });

    it('deve rejeitar campos extras desconhecidos (strip)', () => {
      const result = AuthPayloadSchema.safeParse({
        userId: 'user-123',
        role: 'student',
        extraField: 'should be stripped',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).extraField).toBeUndefined();
      }
    });

    it('deve aceitar validUntil em formato ISO UTC', () => {
      // Zod datetime() aceita apenas formato UTC (com Z)
      const dates = [
        '2024-12-31T23:59:59.999Z',
        '2024-12-31T23:59:59Z',
        '2025-01-15T12:00:00.000Z',
      ];

      for (const validUntil of dates) {
        const result = AuthPayloadSchema.safeParse({
          userId: 'user-123',
          role: 'student',
          validUntil,
        });
        expect(result.success).toBe(true);
      }
    });

    it('deve rejeitar validUntil com formato de data simples', () => {
      const result = AuthPayloadSchema.safeParse({
        userId: 'user-123',
        role: 'student',
        validUntil: '2024-12-31', // Formato de data sem hora
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Token Generation Logic (via mock)', () => {
    // Importa dinamicamente para que o mock seja aplicado
    it('deve chamar SignJWT com payload válido', async () => {
      const { generateToken } = await import('../auth');

      // O mock retorna 'mock.jwt.token'
      const token = await generateToken(validPayload);
      expect(token).toBe('mock.jwt.token');
    });

    it('deve lançar erro para payload inválido', async () => {
      const { generateToken } = await import('../auth');

      const invalidPayload = {
        userId: '',
        role: 'student' as const,
      };

      await expect(generateToken(invalidPayload)).rejects.toThrow('Payload JWT inválido');
    });

    it('deve lançar erro para role inválido', async () => {
      const { generateToken } = await import('../auth');

      const invalidPayload = {
        userId: 'user-123',
        role: 'invalid' as 'student',
      };

      await expect(generateToken(invalidPayload)).rejects.toThrow('Payload JWT inválido');
    });
  });

  describe('Token Verification Logic (via mock)', () => {
    it('deve verificar token válido', async () => {
      const { verifyToken } = await import('../auth');

      const result = await verifyToken('mock.jwt.token');
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
      expect(result?.role).toBe('student');
    });

    it('deve retornar null para token inválido', async () => {
      const { verifyToken } = await import('../auth');

      const result = await verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('deve retornar null para token vazio', async () => {
      const { verifyToken } = await import('../auth');

      const result = await verifyToken('');
      expect(result).toBeNull();
    });
  });
});
