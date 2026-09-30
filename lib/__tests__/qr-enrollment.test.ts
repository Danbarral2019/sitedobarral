// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQrFindUnique, mockEnrollmentFindFirst, mockTxExecuteRaw, mockTxEnrollmentCreate } = vi.hoisted(() => ({
  mockQrFindUnique: vi.fn(),
  mockEnrollmentFindFirst: vi.fn(),
  mockTxExecuteRaw: vi.fn(),
  mockTxEnrollmentCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  const tx = {
    $executeRaw: (...args: unknown[]) => mockTxExecuteRaw(...args),
    enrollment: { create: (...args: unknown[]) => mockTxEnrollmentCreate(...args) },
  };
  return {
    prisma: {
      qRCode: { findUnique: (...args: unknown[]) => mockQrFindUnique(...args) },
      enrollment: { findFirst: (...args: unknown[]) => mockEnrollmentFindFirst(...args) },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import { activatePendingQrEnrollment } from '../qr-enrollment';

function qr(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qr-id',
    code: 'QR-1',
    courseId: '2',
    turma: 'T1',
    validUntil: new Date(Date.now() + 86_400_000),
    maxUses: 10,
    usedCount: 3,
    ...overrides,
  };
}

describe('activatePendingQrEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnrollmentFindFirst.mockResolvedValue(null);
    mockTxEnrollmentCreate.mockResolvedValue({});
  });

  it('com vaga consome a vaga e cria a matrícula de 1 mês', async () => {
    mockQrFindUnique.mockResolvedValueOnce(qr());
    mockTxExecuteRaw.mockResolvedValueOnce(1);

    const result = await activatePendingQrEnrollment('u1', 'qr-id');

    expect(result.status).toBe('enrolled');
    expect(mockQrFindUnique).toHaveBeenCalledWith({ where: { id: 'qr-id' } });
    expect(mockTxExecuteRaw).toHaveBeenCalledTimes(1);
    expect(mockTxEnrollmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', courseId: '2', turma: 'T1', qrCodeId: 'qr-id' }),
    });
    const { expiresAt } = mockTxEnrollmentCreate.mock.calls[0][0].data as { expiresAt: Date };
    const dias = (expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(27.9);
    expect(dias).toBeLessThan(31.1);
  });

  it('sem vaga não cria matrícula', async () => {
    mockQrFindUnique.mockResolvedValueOnce(qr({ usedCount: 10 }));
    mockTxExecuteRaw.mockResolvedValueOnce(0);

    const result = await activatePendingQrEnrollment('u1', 'qr-id');

    expect(result).toEqual({ status: 'qr-full', courseId: '2' });
    expect(mockTxEnrollmentCreate).not.toHaveBeenCalled();
  });

  it('QR vencido não consome vaga', async () => {
    mockQrFindUnique.mockResolvedValueOnce(qr({ validUntil: new Date(Date.now() - 1000) }));

    const result = await activatePendingQrEnrollment('u1', 'qr-id');

    expect(result).toEqual({ status: 'qr-expired', courseId: '2' });
    expect(mockTxExecuteRaw).not.toHaveBeenCalled();
  });

  it('QR apagado não consome vaga', async () => {
    mockQrFindUnique.mockResolvedValueOnce(null);

    const result = await activatePendingQrEnrollment('u1', 'qr-id');

    expect(result).toEqual({ status: 'qr-missing' });
    expect(mockTxExecuteRaw).not.toHaveBeenCalled();
  });

  it('matrícula já existente com o mesmo QR não consome outra vaga', async () => {
    mockQrFindUnique.mockResolvedValueOnce(qr());
    mockEnrollmentFindFirst.mockResolvedValueOnce({ id: 'e1' });

    const result = await activatePendingQrEnrollment('u1', 'qr-id');

    expect(result).toEqual({ status: 'already-enrolled', courseId: '2' });
    expect(mockTxExecuteRaw).not.toHaveBeenCalled();
  });
});
