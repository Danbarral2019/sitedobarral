// @vitest-environment node
/**
 * Cadastro: resposta idêntica para email novo e já cadastrado (sem
 * enumeração de contas, com aviso ao dono) e QR code guardado como pendente,
 * sem matrícula nem consumo de vaga antes da verificação do email.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

const {
  mockUserFindUnique,
  mockUserCreate,
  mockQrFindUnique,
  mockEnrollmentCreate,
  mockExecuteRaw,
  mockAccessLogCreate,
  mockSendVerificationEmail,
  mockSendWelcomeEmail,
  mockSendDuplicateRegistrationEmail,
  mockHash,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockQrFindUnique: vi.fn(),
  mockEnrollmentCreate: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockAccessLogCreate: vi.fn(),
  mockSendVerificationEmail: vi.fn(),
  mockSendWelcomeEmail: vi.fn(),
  mockSendDuplicateRegistrationEmail: vi.fn(),
  mockHash: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/monitoring/events', () => ({ trackServerEvent: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
    qRCode: { findUnique: (...args: unknown[]) => mockQrFindUnique(...args) },
    enrollment: { create: (...args: unknown[]) => mockEnrollmentCreate(...args) },
    accessLog: { create: (...args: unknown[]) => mockAccessLogCreate(...args) },
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
  },
}));

vi.mock('@/lib/email', () => ({
  sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args),
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
  sendDuplicateRegistrationEmail: (...args: unknown[]) => mockSendDuplicateRegistrationEmail(...args),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: (...args: unknown[]) => mockHash(...args) },
}));

import { POST } from '../register/route';

function registerRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const dados = { name: 'Aluno Novo', email: 'Aluno@Exemplo.com', password: 'senha-123' };

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHash.mockResolvedValue('hash');
    mockUserCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'novo-id',
      ...data,
    }));
    mockAccessLogCreate.mockResolvedValue({});
    mockSendVerificationEmail.mockResolvedValue(true);
    mockSendWelcomeEmail.mockResolvedValue(true);
    mockSendDuplicateRegistrationEmail.mockResolvedValue(true);
  });

  describe('email já cadastrado', () => {
    it('responde com o mesmo status e o mesmo corpo do cadastro novo', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);
      const novo = await POST(registerRequest(dados));

      mockUserFindUnique.mockResolvedValueOnce({
        id: 'existente-id',
        email: 'aluno@exemplo.com',
        name: 'Dono da Conta',
        emailVerified: true,
      });
      const repetido = await POST(registerRequest(dados));

      expect(novo.status).toBe(201);
      expect(repetido.status).toBe(novo.status);
      expect(await repetido.json()).toEqual(await novo.json());
    });

    it('não cria nada e avisa o dono da conta por email', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'existente-id',
        email: 'aluno@exemplo.com',
        name: 'Dono da Conta',
        emailVerified: false,
      });

      const res = await POST(registerRequest({ ...dados, qrCodeId: 'QR-1' }));

      expect(res.status).toBe(201);
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockQrFindUnique).not.toHaveBeenCalled();
      expect(mockExecuteRaw).not.toHaveBeenCalled();
      expect(mockEnrollmentCreate).not.toHaveBeenCalled();
      expect(mockAccessLogCreate).not.toHaveBeenCalled();
      expect(mockSendVerificationEmail).not.toHaveBeenCalled();
      expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
      expect(mockSendDuplicateRegistrationEmail).toHaveBeenCalledWith('aluno@exemplo.com', 'Dono da Conta', false);
    });

    it('calcula o hash da senha também no email repetido (tempo de resposta)', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'existente-id',
        email: 'aluno@exemplo.com',
        name: 'Dono',
        emailVerified: true,
      });

      await POST(registerRequest(dados));

      expect(mockHash).toHaveBeenCalledTimes(1);
    });

    it('falha no envio do aviso não muda a resposta', async () => {
      mockUserFindUnique.mockResolvedValueOnce({
        id: 'existente-id',
        email: 'aluno@exemplo.com',
        name: 'Dono',
        emailVerified: true,
      });
      mockSendDuplicateRegistrationEmail.mockResolvedValueOnce(false);

      const res = await POST(registerRequest(dados));

      expect(res.status).toBe(201);
    });

    it('cadastro simultâneo que perde na unicidade responde igual', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);
      mockUserCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const res = await POST(registerRequest(dados));

      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({ success: true });
      expect(mockSendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('cadastro novo', () => {
    it('cria o usuário com email em minúsculas e envia a verificação', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);

      const res = await POST(registerRequest(dados));

      expect(res.status).toBe(201);
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'aluno@exemplo.com',
          emailVerified: false,
          pendingQrCodeId: null,
        }),
      });
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
      const body = await res.json();
      expect(body.user).not.toHaveProperty('id');
    });

    it('com QR válido guarda o QR pendente sem matricular nem consumir vaga', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);
      mockQrFindUnique.mockResolvedValueOnce({
        id: 'qr-id',
        code: 'QR-1',
        courseId: '2',
        turma: 'T1',
        validUntil: new Date(Date.now() + 86_400_000),
        maxUses: 10,
        usedCount: 3,
      });

      const res = await POST(registerRequest({ ...dados, qrCodeId: 'QR-1' }));

      expect(res.status).toBe(201);
      expect(mockQrFindUnique).toHaveBeenCalledWith({ where: { code: 'QR-1' } });
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ pendingQrCodeId: 'qr-id' }),
      });
      expect(mockExecuteRaw).not.toHaveBeenCalled();
      expect(mockEnrollmentCreate).not.toHaveBeenCalled();
      expect(mockAccessLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ qrCode: 'QR-1', courseId: '2', action: 'register' }),
      });
    });

    it('com QR vencido cadastra sem QR pendente', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);
      mockQrFindUnique.mockResolvedValueOnce({
        id: 'qr-id',
        code: 'QR-1',
        courseId: '2',
        turma: 'T1',
        validUntil: new Date(Date.now() - 1000),
        maxUses: null,
        usedCount: 0,
      });

      const res = await POST(registerRequest({ ...dados, qrCodeId: 'QR-1' }));

      expect(res.status).toBe(201);
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ pendingQrCodeId: null }),
      });
    });

    it('com QR inexistente cadastra sem QR pendente', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null);
      mockQrFindUnique.mockResolvedValueOnce(null);

      const res = await POST(registerRequest({ ...dados, qrCodeId: 'NAO-EXISTE' }));

      expect(res.status).toBe(201);
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ pendingQrCodeId: null }),
      });
    });
  });
});
