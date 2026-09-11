// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findUnique: vi.fn(),
  delete: vi.fn(),
  invalidate: vi.fn(),
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
  CacheInvalidation: { recommendedSites: mocks.invalidate },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    recommendedSite: { findUnique: mocks.findUnique, delete: mocks.delete },
  },
}));

import { DELETE } from '../route';

const ADMIN = { userId: 'admin-1', email: 'admin@example.com', role: 'admin' };

function apagar(id = 'site-1') {
  const request = new NextRequest(`http://localhost/api/admin/sites/${id}`, { method: 'DELETE' });
  return DELETE(request, { params: Promise.resolve({ id }) });
}

describe('DELETE /api/admin/sites/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(ADMIN);
    mocks.findUnique.mockResolvedValue({ id: 'site-1', title: 'Portal de Compras' });
    mocks.delete.mockResolvedValue({ id: 'site-1' });
    mocks.invalidate.mockResolvedValue(0);
  });

  it('nega exclusao sem autenticacao antes de apagar', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await apagar();

    expect(response.status).toBe(401);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('nega exclusao a quem nao e admin', async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...ADMIN, role: 'student' });

    const response = await apagar();

    expect(response.status).toBe(403);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('devolve 404 quando o site nao existe', async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await apagar('inexistente');

    expect(response.status).toBe(404);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('apaga o site e invalida o cache da lista publica', async () => {
    const response = await apagar();

    expect(response.status).toBe(200);
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'site-1' } });
    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
  });
});
