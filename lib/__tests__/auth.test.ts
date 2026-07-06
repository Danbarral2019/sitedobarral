/**
 * Testes para lib/auth.ts
 *
 * Testa validação de payload JWT com schema Zod.
 * Os testes de geração/verificação de token são testados via integração
 * pois a biblioteca jose requer ambiente Web Crypto.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthPayloadSchema } from '../auth';

// Mock de next/headers — cookies() retorna Promise no Next.js 15
// vi.hoisted() garante que a variável está disponível quando vi.mock é hoisted
const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

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

    it('deve retornar null quando jwtVerify retorna payload inválido', async () => {
      const jose = await import('jose');
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: { userId: '', role: 'invalid' },
        protectedHeader: { alg: 'HS256' },
      } as never);

      const { verifyToken } = await import('../auth');
      const result = await verifyToken('valid.token');
      expect(result).toBeNull();
    });
  });

  describe('generateToken — edge cases', () => {
    it('deve gerar token com validUntil futuro', async () => {
      const { generateToken } = await import('../auth');
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const token = await generateToken({
        userId: 'user-123',
        role: 'student',
        validUntil: futureDate,
      });
      expect(token).toBe('mock.jwt.token');
    });

    it('deve lançar erro para validUntil no passado', async () => {
      const { generateToken } = await import('../auth');
      const pastDate = new Date(Date.now() - 86400000).toISOString();

      await expect(generateToken({
        userId: 'user-123',
        role: 'student',
        validUntil: pastDate,
      })).rejects.toThrow('Acesso expirado');
    });

    it('deve lançar erro para validUntil com data inválida', async () => {
      const { generateToken } = await import('../auth');

      await expect(generateToken({
        userId: 'user-123',
        role: 'student',
        validUntil: 'invalid-date-format' as unknown as string,
      })).rejects.toThrow();
    });

    it('deve gerar token para admin sem courseId', async () => {
      const { generateToken } = await import('../auth');

      const token = await generateToken(adminPayload);
      expect(token).toBe('mock.jwt.token');
    });
  });

  describe('verifyAuth (via NextRequest mock)', () => {
    it('deve retornar valid:false sem cookie', async () => {
      const { verifyAuth } = await import('../auth');

      const _request = new Request('http://localhost:3000/api/test');
      const nextRequest = {
        cookies: { get: vi.fn().mockReturnValue(undefined) },
        headers: new Headers(),
      } as unknown as import('next/server').NextRequest;

      const result = await verifyAuth(nextRequest);
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('deve retornar valid:true com cookie válido', async () => {
      const { verifyAuth } = await import('../auth');

      const nextRequest = {
        cookies: { get: vi.fn().mockReturnValue({ value: 'mock.jwt.token' }) },
        headers: new Headers(),
      } as unknown as import('next/server').NextRequest;

      const result = await verifyAuth(nextRequest);
      expect(result.valid).toBe(true);
      expect(result.user?.userId).toBe('user-123');
    });

    it('deve retornar valid:false com cookie inválido', async () => {
      const { verifyAuth } = await import('../auth');

      const nextRequest = {
        cookies: { get: vi.fn().mockReturnValue({ value: 'bad-token' }) },
        headers: new Headers(),
      } as unknown as import('next/server').NextRequest;

      const result = await verifyAuth(nextRequest);
      expect(result.valid).toBe(false);
    });
  });

  describe('getTokenFromCookies', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReset();
    });

    it('deve retornar o valor do cookie auth-token quando presente', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'my-jwt-token' });
      const { getTokenFromCookies } = await import('../auth');

      const token = await getTokenFromCookies();
      expect(token).toBe('my-jwt-token');
      expect(mockCookieStore.get).toHaveBeenCalledWith('auth-token');
    });

    it('deve retornar null quando cookie auth-token nao existe', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      const { getTokenFromCookies } = await import('../auth');

      const token = await getTokenFromCookies();
      expect(token).toBeNull();
    });

    it('deve retornar null quando cookie tem valor vazio', async () => {
      mockCookieStore.get.mockReturnValue({ value: '' });
      const { getTokenFromCookies } = await import('../auth');

      const token = await getTokenFromCookies();
      expect(token).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReset();
    });

    it('deve retornar usuario quando cookie tem token valido', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'mock.jwt.token' });
      const { getCurrentUser } = await import('../auth');

      const user = await getCurrentUser();
      expect(user).not.toBeNull();
      expect(user?.userId).toBe('user-123');
      expect(user?.role).toBe('student');
    });

    it('deve retornar null quando nao ha cookie', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      const { getCurrentUser } = await import('../auth');

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it('deve retornar null quando token e invalido', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'invalid-token-xyz' });
      const { getCurrentUser } = await import('../auth');

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('hasAccessToCourse', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReset();
    });

    it('deve retornar false quando usuario nao esta autenticado', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      const { hasAccessToCourse } = await import('../auth');

      const result = await hasAccessToCourse('course-1');
      expect(result).toBe(false);
    });

    it('deve retornar true quando admin (acesso a qualquer curso)', async () => {
      // Mockar jwtVerify para retornar admin
      const jose = await import('jose');
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: { userId: 'admin-1', role: 'admin' },
        protectedHeader: { alg: 'HS256' },
      } as never);

      mockCookieStore.get.mockReturnValue({ value: 'valid.admin.token' });
      const { hasAccessToCourse } = await import('../auth');

      const result = await hasAccessToCourse('any-course');
      expect(result).toBe(true);
    });

    it('deve retornar true quando estudante acessa seu proprio curso', async () => {
      // jwtVerify default mock retorna courseId: 'course-1'
      mockCookieStore.get.mockReturnValue({ value: 'mock.jwt.token' });
      const { hasAccessToCourse } = await import('../auth');

      const result = await hasAccessToCourse('course-1');
      expect(result).toBe(true);
    });

    it('deve retornar false quando estudante acessa curso diferente', async () => {
      // jwtVerify default mock retorna courseId: 'course-1'
      mockCookieStore.get.mockReturnValue({ value: 'mock.jwt.token' });
      const { hasAccessToCourse } = await import('../auth');

      const result = await hasAccessToCourse('course-999');
      expect(result).toBe(false);
    });
  });

  describe('isAdmin', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReset();
    });

    it('deve retornar true quando usuario e admin', async () => {
      const jose = await import('jose');
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: { userId: 'admin-1', role: 'admin' },
        protectedHeader: { alg: 'HS256' },
      } as never);

      mockCookieStore.get.mockReturnValue({ value: 'valid.admin.token' });
      const { isAdmin } = await import('../auth');

      const result = await isAdmin();
      expect(result).toBe(true);
    });

    it('deve retornar false quando usuario e student', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'mock.jwt.token' });
      const { isAdmin } = await import('../auth');

      const result = await isAdmin();
      expect(result).toBe(false);
    });

    it('deve retornar false quando nao ha usuario autenticado', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      const { isAdmin } = await import('../auth');

      const result = await isAdmin();
      expect(result).toBe(false);
    });
  });

  describe('createAuthSession', () => {
    beforeEach(() => {
      mockCookieStore.get.mockReset();
      mockCookieStore.set.mockReset();
    });

    it('deve gerar token e setar cookie com opcoes corretas', async () => {
      const { createAuthSession } = await import('../auth');

      const payload = {
        userId: 'user-123',
        role: 'student' as const,
        courseId: 'course-1',
      };

      const token = await createAuthSession(payload);
      expect(token).toBe('mock.jwt.token');
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-token',
        'mock.jwt.token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        }),
      );
    });

    it('deve usar maxAge de 7 dias quando nao ha validUntil', async () => {
      const { createAuthSession } = await import('../auth');

      const payload = {
        userId: 'user-123',
        role: 'student' as const,
      };

      await createAuthSession(payload);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-token',
        'mock.jwt.token',
        expect.objectContaining({
          maxAge: 7 * 24 * 60 * 60,
        }),
      );
    });

    it('deve calcular maxAge custom quando validUntil esta no futuro', async () => {
      const { createAuthSession } = await import('../auth');
      const futureDate = new Date(Date.now() + 3600000).toISOString(); // +1 hora

      const payload = {
        userId: 'user-123',
        role: 'student' as const,
        validUntil: futureDate,
      };

      await createAuthSession(payload);

      const callArgs = mockCookieStore.set.mock.calls[0];
      const options = callArgs[2];
      // maxAge deve ser aproximadamente 3600 (1 hora em segundos)
      expect(options.maxAge).toBeGreaterThan(3500);
      expect(options.maxAge).toBeLessThanOrEqual(3600);
    });

    it('deve setar secure:true em producao', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string>).NODE_ENV = 'production';

      const { createAuthSession } = await import('../auth');
      await createAuthSession({
        userId: 'user-123',
        role: 'student' as const,
      });

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-token',
        'mock.jwt.token',
        expect.objectContaining({ secure: true }),
      );

      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    });

    it('deve rejeitar payload invalido', async () => {
      const { createAuthSession } = await import('../auth');

      await expect(
        createAuthSession({
          userId: '',
          role: 'student' as const,
        }),
      ).rejects.toThrow('Payload JWT inválido');
    });
  });

  describe('destroyAuthSession', () => {
    beforeEach(() => {
      mockCookieStore.delete.mockReset();
    });

    it('deve deletar o cookie auth-token', async () => {
      const { destroyAuthSession } = await import('../auth');

      await destroyAuthSession();
      expect(mockCookieStore.delete).toHaveBeenCalledWith('auth-token');
    });

    it('deve chamar delete exatamente uma vez', async () => {
      const { destroyAuthSession } = await import('../auth');

      await destroyAuthSession();
      expect(mockCookieStore.delete).toHaveBeenCalledTimes(1);
    });
  });
});
