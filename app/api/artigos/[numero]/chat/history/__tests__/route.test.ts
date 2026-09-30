// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    articleQuestion: { findMany: (...args: unknown[]) => mocks.findMany(...args) },
  },
}));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
}));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: async () => undefined,
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/logger', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => logger };
  return { apiLogger: logger };
});

import { GET } from '../route';

const params = { params: Promise.resolve({ numero: '75' }) };

describe('GET /api/artigos/[numero]/chat/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.getCurrentUser.mockResolvedValue({ userId: 'user-1', email: 'a@x.com', role: 'student' });
  });

  it('exige login', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/artigos/75/chat/history'), params);
    expect(res.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('lista só as perguntas do próprio usuário', async () => {
    const res = await GET(new NextRequest('http://localhost/api/artigos/75/chat/history'), params);
    expect(res.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ articleNumber: '75', userId: 'user-1' }),
      }),
    );
  });
});
