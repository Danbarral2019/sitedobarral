// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockCreate,
  mockVerifyAuth,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockVerifyAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    searchHistory: {
      create: (...args: any[]) => mockCreate(...args),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyAuth: (...args: any[]) => mockVerifyAuth(...args),
}));

import { POST } from '@/app/api/area-restrita/search-history/route';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/area-restrita/search-history', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ORIGINAL_FLAG = process.env.SEARCH_ANALYTICS_ENABLED;

beforeEach(() => {
  mockCreate.mockReset();
  mockVerifyAuth.mockReset();

  mockVerifyAuth.mockResolvedValue({
    valid: true,
    user: { userId: 'u1', email: 'u@x.com', role: 'student' },
  });
  mockCreate.mockResolvedValue({ id: 'sh-1' });
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) {
    delete process.env.SEARCH_ANALYTICS_ENABLED;
  } else {
    process.env.SEARCH_ANALYTICS_ENABLED = ORIGINAL_FLAG;
  }
});

describe('POST /api/area-restrita/search-history (feature flag)', () => {
  it('grava normalmente quando SEARCH_ANALYTICS_ENABLED não definido (default on)', async () => {
    delete process.env.SEARCH_ANALYTICS_ENABLED;
    const res = await POST(
      makeReq({ type: 'documents', query: 'lei 14133 contratos' }) as any,
    );
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledOnce();
    const json = await res.json();
    expect(json).toEqual({ id: 'sh-1' });
  });

  it('grava normalmente com SEARCH_ANALYTICS_ENABLED=true explícito', async () => {
    process.env.SEARCH_ANALYTICS_ENABLED = 'true';
    const res = await POST(
      makeReq({ type: 'documents', query: 'pregão eletrônico' }) as any,
    );
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('retorna { id: null, disabled: true } sem gravar quando SEARCH_ANALYTICS_ENABLED=false', async () => {
    process.env.SEARCH_ANALYTICS_ENABLED = 'false';
    const res = await POST(
      makeReq({ type: 'documents', query: 'qualquer query' }) as any,
    );
    expect(res.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json).toEqual({ id: null, disabled: true });
  });

  it('mantém checagem de auth mesmo com flag desligada', async () => {
    process.env.SEARCH_ANALYTICS_ENABLED = 'false';
    mockVerifyAuth.mockResolvedValue({ valid: false });
    const res = await POST(
      makeReq({ type: 'documents', query: 'foo' }) as any,
    );
    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
