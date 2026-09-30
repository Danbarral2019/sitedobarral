// @vitest-environment node
/**
 * Verificação de email: consumo atômico do token e ativação da matrícula
 * pelo QR code guardado no cadastro. Sem vaga, o email é verificado mesmo
 * assim.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockUserFindUnique,
  mockUserUpdateMany,
  mockGenerateToken,
  mockActivate,
  mockSendCourseWelcomeEmail,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserUpdateMany: vi.fn(),
  mockGenerateToken: vi.fn(),
  mockActivate: vi.fn(),
  mockSendCourseWelcomeEmail: vi.fn(),
}));

vi.mock('@/lib/monitoring/events', () => ({ trackServerEvent: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUserUpdateMany(...args),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  generateToken: (...args: unknown[]) => mockGenerateToken(...args),
}));

vi.mock('@/lib/qr-enrollment', () => ({
  activatePendingQrEnrollment: (...args: unknown[]) => mockActivate(...args),
}));

vi.mock('@/lib/email', () => ({
  sendCourseWelcomeEmail: (...args: unknown[]) => mockSendCourseWelcomeEmail(...args),
}));

import { POST } from '../verify-email/route';
import { courses } from '@/data/courses';

function verifyRequest(token: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

function pendingUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'a@b.com',
    name: 'Aluno',
    role: 'student',
    tokenVersion: 0,
    verificationExpiry: new Date(Date.now() + 60_000),
    pendingQrCodeId: null,
    ...overrides,
  };
}

const updatedUser = { id: 'u1', name: 'Aluno', email: 'a@b.com', role: 'student', enrollments: [] };

describe('POST /api/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateToken.mockResolvedValue('jwt');
    mockUserUpdateMany.mockResolvedValue({ count: 1 });
    mockSendCourseWelcomeEmail.mockResolvedValue(true);
  });

  it('marca o email como verificado consumindo o token de forma condicional', async () => {
    mockUserFindUnique.mockResolvedValueOnce(pendingUser()).mockResolvedValueOnce(updatedUser);

    const res = await POST(verifyRequest('tok'));

    expect(res.status).toBe(200);
    expect(mockUserUpdateMany).toHaveBeenCalledWith({
      where: { id: 'u1', verificationToken: 'tok' },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpiry: null,
        pendingQrCodeId: null,
      },
    });
    expect(mockActivate).not.toHaveBeenCalled();
    expect(mockGenerateToken).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', tv: 0 }));
  });

  it('com QR pendente cria a matrícula e envia as boas-vindas ao curso', async () => {
    const course = courses[0];
    mockUserFindUnique
      .mockResolvedValueOnce(pendingUser({ pendingQrCodeId: 'qr-id' }))
      .mockResolvedValueOnce(updatedUser);
    mockActivate.mockResolvedValueOnce({ status: 'enrolled', courseId: course.id, expiresAt: new Date() });

    const res = await POST(verifyRequest('tok'));

    expect(res.status).toBe(200);
    expect(mockActivate).toHaveBeenCalledWith('u1', 'qr-id');
    expect(mockSendCourseWelcomeEmail).toHaveBeenCalledWith('a@b.com', 'Aluno', course.title, course.slug);
  });

  it('QR sem vaga: o email é verificado mesmo assim, sem boas-vindas ao curso', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce(pendingUser({ pendingQrCodeId: 'qr-id' }))
      .mockResolvedValueOnce(updatedUser);
    mockActivate.mockResolvedValueOnce({ status: 'qr-full', courseId: '2' });

    const res = await POST(verifyRequest('tok'));

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(mockSendCourseWelcomeEmail).not.toHaveBeenCalled();
  });

  it('erro ao matricular não impede a verificação', async () => {
    mockUserFindUnique
      .mockResolvedValueOnce(pendingUser({ pendingQrCodeId: 'qr-id' }))
      .mockResolvedValueOnce(updatedUser);
    mockActivate.mockRejectedValueOnce(new Error('db'));

    const res = await POST(verifyRequest('tok'));

    expect(res.status).toBe(200);
  });

  it('chamada concorrente que perde o token não tenta matricular de novo', async () => {
    mockUserFindUnique.mockResolvedValueOnce(pendingUser({ pendingQrCodeId: 'qr-id' }));
    mockUserUpdateMany.mockResolvedValueOnce({ count: 0 });

    const res = await POST(verifyRequest('tok'));

    expect(res.status).toBe(400);
    expect(mockActivate).not.toHaveBeenCalled();
    expect(mockGenerateToken).not.toHaveBeenCalled();
  });

  it('token expirado não verifica nem matricula', async () => {
    mockUserFindUnique.mockResolvedValueOnce(
      pendingUser({ pendingQrCodeId: 'qr-id', verificationExpiry: new Date(Date.now() - 1000) }),
    );

    const res = await POST(verifyRequest('tok'));

    expect(res.status).toBe(400);
    expect(mockUserUpdateMany).not.toHaveBeenCalled();
    expect(mockActivate).not.toHaveBeenCalled();
  });
});
