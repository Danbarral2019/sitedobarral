// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));
vi.mock('@sentry/nextjs', () => ({
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  setTag: vi.fn(),
  captureException: vi.fn(),
}));
vi.mock('@/lib/logger', () => {
  const logger = {
    child: () => logger,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { apiLogger: logger, authLogger: logger, logger };
});
vi.mock('@/lib/cache/redis-client', () => ({
  CacheInvalidation: { testimonials: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    testimonial: {
      findMany: mocks.findMany,
      count: mocks.count,
      create: mocks.create,
      update: mocks.update,
      delete: mocks.delete,
    },
  },
}));

import { DELETE, GET, PATCH, POST } from '../route';

describe('GET /api/admin/depoimentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
  });

  it('nega acesso sem autenticação antes de consultar dados pessoais', async () => {
    const request = new NextRequest('http://localhost/api/admin/depoimentos');
    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });
});

describe('mutações em /api/admin/depoimentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: 'testimonial-1' });
    mocks.update.mockResolvedValue({ id: 'testimonial-1' });
    mocks.delete.mockResolvedValue({ id: 'testimonial-1' });
  });

  it('nega criação sem autenticação antes de gravar', async () => {
    const request = new NextRequest('http://localhost/api/admin/depoimentos', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Pessoa',
        email: 'pessoa@example.com',
        role: 'Aluno',
        text: 'Depoimento',
      }),
    });
    const response = await POST(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('nega mudança de status sem autenticação antes de gravar', async () => {
    const request = new NextRequest('http://localhost/api/admin/depoimentos', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'testimonial-1', status: 'approved' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('nega exclusão sem autenticação antes de apagar', async () => {
    const request = new NextRequest('http://localhost/api/admin/depoimentos', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'testimonial-1' }),
    });
    const response = await DELETE(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
