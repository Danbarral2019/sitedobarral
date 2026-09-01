// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  documentFindMany: vi.fn(),
  legislativeActFindMany: vi.fn(),
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
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: mocks.documentFindMany },
    legislativeAct: { findMany: mocks.legislativeActFindMany },
  },
}));

import { GET } from '../route';

describe('GET /api/admin/analytics/document-analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.documentFindMany.mockResolvedValue([]);
    mocks.legislativeActFindMany.mockResolvedValue([]);
  });

  it('nega acesso sem autenticação antes de consultar analytics internos', async () => {
    const request = new NextRequest('http://localhost/api/admin/analytics/document-analysis');
    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(mocks.documentFindMany).not.toHaveBeenCalled();
    expect(mocks.legislativeActFindMany).not.toHaveBeenCalled();
  });
});
