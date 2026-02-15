/**
 * Testes para API de Login
 *
 * Testa o fluxo completo de autenticação de estudantes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock logger BEFORE other imports (used by error-handler and route)
vi.mock('@/lib/logger', () => ({
  authLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Redis rate limiting
const mockEnforceRateLimit = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    accessLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  generateToken: vi.fn().mockResolvedValue('mock.jwt.token'),
}));

// Import after mocks
import { POST } from '../login/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;
const mockBcrypt = vi.mocked(bcrypt);

// Helper para criar NextRequest
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  const validCredentials = {
    email: 'aluno@teste.com',
    password: 'senha123',
  };

  const mockStudent = {
    id: 'user-123',
    name: 'Aluno Teste',
    email: 'aluno@teste.com',
    passwordHash: 'hashed_password',
    role: 'student',
    emailVerified: true,
    enrollments: [
      {
        id: 'enroll-1',
        courseId: '2',
        validUntil: new Date(Date.now() + 86400000),
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset rate limiter to success by default
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  describe('Validação de Input', () => {
    it('deve rejeitar requisição sem email', async () => {
      const request = createRequest({ password: 'senha123' });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Dados inválidos');
    });

    it('deve rejeitar requisição sem senha', async () => {
      const request = createRequest({ email: 'aluno@teste.com' });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Dados inválidos');
    });

    it('deve rejeitar email inválido', async () => {
      const request = createRequest({
        email: 'email-invalido',
        password: 'senha123',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Dados inválidos');
    });

    it('deve rejeitar senha muito curta', async () => {
      const request = createRequest({
        email: 'aluno@teste.com',
        password: '123', // menos de 6 caracteres
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('deve verificar rate limit via Redis', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null as never);

      const request = createRequest(validCredentials);
      await POST(request);

      expect(mockEnforceRateLimit).toHaveBeenCalledWith('auth:login:127.0.0.1', 5, 60);
    });

    it('deve retornar 429 quando rate limit excedido', async () => {
      const { RateLimitError } = await import('@/lib/errors/api-error');
      mockEnforceRateLimit.mockRejectedValue(new RateLimitError('Muitas tentativas. Tente novamente em breve.', 60));

      const request = createRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain('Muitas tentativas');
    });
  });

  describe('Autenticação de Usuário', () => {
    it('deve retornar 401 quando usuário não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null as never);

      const request = createRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Email ou senha incorretos');
    });

    it('deve buscar usuário com email em lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null as never);

      const request = createRequest({
        email: 'ALUNO@TESTE.COM',
        password: 'senha123',
      });
      await POST(request);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'aluno@teste.com' },
        include: { enrollments: true },
      });
    });

    it('deve retornar 403 para usuário admin tentando logar', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockStudent,
        role: 'admin',
      } as never);

      const request = createRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('login administrativo');
    });

    it('deve retornar 401 quando senha está incorreta', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent as never);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const request = createRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Email ou senha incorretos');
    });

    it('deve retornar 403 quando email não verificado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockStudent,
        emailVerified: false,
      } as never);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const request = createRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Email não verificado');
      expect(data.needsVerification).toBe(true);
    });
  });

  describe('Login Bem-sucedido', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent as never);
      mockBcrypt.compare.mockResolvedValue(true as never);
    });

    it('deve retornar 200 com dados do usuário', async () => {
      const request = createRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toMatchObject({
        id: mockStudent.id,
        name: mockStudent.name,
        email: mockStudent.email,
        role: mockStudent.role,
      });
    });

    it('deve incluir enrollments na resposta', async () => {
      const request = createRequest(validCredentials);
      const response = await POST(request);

      const data = await response.json();
      expect(data.user.enrollments).toBeDefined();
      expect(data.user.enrollments).toHaveLength(1);
    });

    it('deve definir cookie auth-token', async () => {
      const request = createRequest(validCredentials);
      const response = await POST(request);

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('auth-token=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/');
    });

    it('deve criar log de acesso', async () => {
      const request = createRequest(validCredentials);
      await POST(request);

      expect(mockPrisma.accessLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockStudent.id,
          action: 'login',
        }),
      });
    });

    it('deve continuar mesmo se criação de log falhar', async () => {
      mockPrisma.accessLog.create.mockRejectedValue(new Error('Log error'));

      const request = createRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Segurança', () => {
    it('deve retornar mesma mensagem para usuário inexistente e senha errada', async () => {
      // Usuário não existe
      mockPrisma.user.findUnique.mockResolvedValue(null as never);
      const request1 = createRequest(validCredentials);
      const response1 = await POST(request1);
      const data1 = await response1.json();

      // Senha incorreta
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent as never);
      mockBcrypt.compare.mockResolvedValue(false as never);
      const request2 = createRequest(validCredentials);
      const response2 = await POST(request2);
      const data2 = await response2.json();

      // Mensagens idênticas para evitar enumeração de usuários
      expect(data1.error).toBe(data2.error);
    });

    it('não deve expor hash de senha na resposta', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockStudent as never);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const request = createRequest(validCredentials);
      const response = await POST(request);
      const data = await response.json();

      expect(data.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(data)).not.toContain('passwordHash');
    });
  });

  describe('Edge Cases', () => {
    it('deve tratar body JSON inválido', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid-json',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('deve rejeitar email com espaços extras (sem trim)', async () => {
      // O schema não faz trim, então emails com espaços serão inválidos
      const request = createRequest({
        email: '  aluno@teste.com  ',
        password: 'senha123',
      });
      const response = await POST(request);

      // Email com espaços é considerado inválido pelo Zod
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Dados inválidos');
    });
  });
});
