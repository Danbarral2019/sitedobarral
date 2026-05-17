// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

// Mock withAdminApi como identity — testes focam na lógica do handler,
// não na autenticação (essa é coberta pelo middleware testes próprios).
// O ctx.user e ctx.params são injetados direto pelo teste.
vi.mock('@/lib/api/handler', () => ({
  withAdminApi: (handler: unknown) => handler,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    legislativeActRelation: { update: mockUpdate, delete: mockDelete },
  },
}));

vi.mock('@/lib/errors/error-handler', () => ({
  handleApiError: (err: unknown) => {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { PATCH, DELETE } from '../route';

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/admin/legislative-relations/r1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// withAdminApi resolves params before calling the handler, so ctx.params is already the resolved object
const adminContext = (id: string) => ({
  params: { id },
  user: { userId: 'admin-1', email: 'admin@test.com', role: 'admin' as const },
  requestId: 'test-req-id',
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
});

describe('PATCH /api/admin/legislative-relations/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirma relação (action=confirm)', async () => {
    mockUpdate.mockResolvedValue({ id: 'r1', reviewStatus: 'confirmed' });

    const res = await PATCH(makeRequest({ action: 'confirm' }) as never, adminContext('r1') as never);
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({
        reviewStatus: 'confirmed',
        confirmedBy: 'admin@test.com',
        confirmedAt: expect.any(Date),
      }),
    });
  });

  it('rejeita relação (action=reject) marca reviewStatus=rejected', async () => {
    mockUpdate.mockResolvedValue({ id: 'r1', reviewStatus: 'rejected' });

    const res = await PATCH(makeRequest({ action: 'reject' }) as never, adminContext('r1') as never);
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ reviewStatus: 'rejected' }),
    });
  });

  it('retorna 400 pra action inválida', async () => {
    const res = await PATCH(makeRequest({ action: 'invalido' }) as never, adminContext('r1') as never);
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/legislative-relations/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deleta a relação', async () => {
    mockDelete.mockResolvedValue({ id: 'r1' });

    const res = await DELETE(makeRequest({}) as never, adminContext('r1') as never);
    expect(res.status).toBe(200);

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });
});
