// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getCurrentUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({ getCurrentUser }));
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

import { GET } from '../route';

describe('GET /api/admin/legislative-acts/import/template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(null);
  });

  it('nega acesso sem autenticação ao template administrativo', async () => {
    const request = new NextRequest('http://localhost/api/admin/legislative-acts/import/template');
    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
  });
});
