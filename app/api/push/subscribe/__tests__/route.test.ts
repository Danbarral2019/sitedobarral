// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  upsert: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: (...a: unknown[]) => m.getCurrentUser(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      upsert: (...a: unknown[]) => m.upsert(...a),
      findMany: (...a: unknown[]) => m.findMany(...a),
      deleteMany: (...a: unknown[]) => m.deleteMany(...a),
    },
  },
}));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...a: unknown[]) => m.rateLimit(...a),
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  authLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from '../route';

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({}) } as never,
  );

const keys = { p256dh: 'BPk', auth: 'aut' };

beforeEach(() => {
  vi.clearAllMocks();
  m.getCurrentUser.mockResolvedValue({ userId: 'u1', role: 'student', email: 'a@b.c' });
  m.upsert.mockResolvedValue({});
  m.findMany.mockResolvedValue([]);
  m.deleteMany.mockResolvedValue({ count: 0 });
  m.rateLimit.mockResolvedValue(undefined);
});

describe('POST /api/push/subscribe', () => {
  it('recusa endpoint fora dos serviços de push', async () => {
    const res = await post({ endpoint: 'https://169.254.169.254/latest', keys });
    expect(res.status).toBe(400);
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it('aceita endpoint do FCM', async () => {
    const res = await post({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys });
    expect(res.status).toBe(200);
    expect(m.upsert).toHaveBeenCalled();
    expect(m.deleteMany).not.toHaveBeenCalled();
  });

  it('apaga as assinaturas excedentes do usuário', async () => {
    m.findMany.mockResolvedValue([{ id: 's-old-1' }, { id: 's-old-2' }]);
    const res = await post({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys });
    expect(res.status).toBe(200);
    expect(m.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10 }));
    expect(m.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['s-old-1', 's-old-2'] }, userId: 'u1' },
    });
  });
});
