// @vitest-environment node
/**
 * Revogação de JWT por User.tokenVersion nas rotas que encerram ou trocam a
 * credencial: logout, troca de senha do admin e redefinição de senha. Cada
 * uma incrementa a versão; as que mantêm o usuário logado emitem o token novo
 * já na versão incrementada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockUserFindUnique,
  mockUserUpdate,
  mockAccessLogCreate,
  mockGenerateToken,
  mockVerifyToken,
  mockVerifyAuth,
  mockRevokeUserTokens,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockAccessLogCreate: vi.fn(),
  mockGenerateToken: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockVerifyAuth: vi.fn(),
  mockRevokeUserTokens: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    accessLog: {
      create: (...args: unknown[]) => mockAccessLogCreate(...args),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  generateToken: (...args: unknown[]) => mockGenerateToken(...args),
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  revokeUserTokens: (...args: unknown[]) => mockRevokeUserTokens(...args),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('novo-hash'),
  },
}));

import { GET as logoutGet, POST as logoutPost } from '../logout/route';
import { POST as adminChangePassword } from '../admin-change-password/route';
import { POST as resetPassword } from '../reset-password/route';

function jsonRequest(url: string, body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = `auth-token=${cookie}`;
  return new NextRequest(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

function cookieRequest(url: string, method: 'GET' | 'POST', cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = `auth-token=${cookie}`;
  return new NextRequest(url, { method, headers });
}

describe('revogação de sessão (tokenVersion)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateToken.mockResolvedValue('token.novo');
    mockAccessLogCreate.mockResolvedValue({});
  });

  describe('logout', () => {
    it('POST incrementa tokenVersion do dono do token e apaga o cookie', async () => {
      mockVerifyToken.mockResolvedValue({ userId: 'u1', role: 'student', tv: 0 });
      mockRevokeUserTokens.mockResolvedValue(1);

      const res = await logoutPost(cookieRequest('http://localhost:3000/api/auth/logout', 'POST', 'tok'));

      expect(res.status).toBe(200);
      expect(mockVerifyToken).toHaveBeenCalledWith('tok');
      expect(mockRevokeUserTokens).toHaveBeenCalledWith('u1');
      expect(res.cookies.get('auth-token')?.value).toBe('');
    });

    it('GET também revoga e redireciona', async () => {
      mockVerifyToken.mockResolvedValue({ userId: 'u2', role: 'admin', tv: 4 });
      mockRevokeUserTokens.mockResolvedValue(5);

      const res = await logoutGet(cookieRequest('http://localhost:3000/api/auth/logout', 'GET', 'tok'));

      expect(res.status).toBe(307);
      expect(mockRevokeUserTokens).toHaveBeenCalledWith('u2');
    });

    it('token já revogado ou inválido não incrementa de novo, mas o logout segue', async () => {
      mockVerifyToken.mockResolvedValue(null);

      const res = await logoutPost(cookieRequest('http://localhost:3000/api/auth/logout', 'POST', 'velho'));

      expect(res.status).toBe(200);
      expect(mockRevokeUserTokens).not.toHaveBeenCalled();
      expect(res.cookies.get('auth-token')?.value).toBe('');
    });

    it('sem cookie não consulta nada', async () => {
      const res = await logoutPost(cookieRequest('http://localhost:3000/api/auth/logout', 'POST'));

      expect(res.status).toBe(200);
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it('erro ao revogar não impede o logout', async () => {
      mockVerifyToken.mockResolvedValue({ userId: 'u1', role: 'student' });
      mockRevokeUserTokens.mockRejectedValue(new Error('db down'));

      const res = await logoutPost(cookieRequest('http://localhost:3000/api/auth/logout', 'POST', 'tok'));

      expect(res.status).toBe(200);
      expect(res.cookies.get('auth-token')?.value).toBe('');
    });
  });

  describe('troca de senha do admin', () => {
    it('grava a senha nova incrementando tokenVersion e reemite o cookie na versão nova', async () => {
      mockVerifyAuth.mockResolvedValue({ valid: true, user: { userId: 'adm', role: 'admin', tv: 2 } });
      mockUserFindUnique.mockResolvedValue({ id: 'adm', passwordHash: 'hash-antigo', tokenVersion: 2 });
      mockUserUpdate.mockResolvedValue({ tokenVersion: 3 });

      const res = await adminChangePassword(
        jsonRequest('http://localhost:3000/api/auth/admin-change-password', {
          currentPassword: 'senha-atual',
          newPassword: 'senha-nova-123',
        }),
      );

      expect(res.status).toBe(200);
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'adm' },
        data: { passwordHash: 'novo-hash', tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });
      expect(mockGenerateToken).toHaveBeenCalledWith({ userId: 'adm', role: 'admin', tv: 3 });
      expect(res.cookies.get('auth-token')?.value).toBe('token.novo');
    });
  });

  describe('redefinição de senha', () => {
    it('incrementa tokenVersion e o auto-login usa a versão nova', async () => {
      mockUserFindUnique
        .mockResolvedValueOnce({
          id: 'u1',
          email: 'a@b.com',
          role: 'student',
          tokenVersion: 7,
          resetPasswordExpiry: new Date(Date.now() + 60_000),
        })
        .mockResolvedValueOnce({ id: 'u1', name: 'A', email: 'a@b.com', role: 'student', enrollments: [] });
      mockUserUpdate.mockResolvedValue({ tokenVersion: 8 });

      const res = await resetPassword(
        jsonRequest('http://localhost:3000/api/auth/reset-password', { token: 'reset-tok', newPassword: 'nova-senha' }),
      );

      expect(res.status).toBe(200);
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ passwordHash: 'novo-hash', tokenVersion: { increment: 1 } }),
        }),
      );
      expect(mockGenerateToken).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', tv: 8 }));
    });
  });
});
