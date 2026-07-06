// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetchUnifiedById } = vi.hoisted(() => ({
  mockFetchUnifiedById: vi.fn(),
}));

vi.mock('@/lib/jurisprudencia/unified-query', () => ({
  fetchUnifiedById: (...args: any[]) => mockFetchUnifiedById(...args),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/jurisprudencia/[id]/route';

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/jurisprudencia/anything', {
    method: 'GET',
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  mockFetchUnifiedById.mockReset();
});

describe('GET /api/jurisprudencia/[id]', () => {
  it('retorna 200 com o decision quando encontrado', async () => {
    mockFetchUnifiedById.mockResolvedValueOnce({
      id: 'abc',
      tribunalCode: 'TCU',
      sourceType: 'document-tcu',
    });

    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.id).toBe('abc');
    expect(body.tribunalCode).toBe('TCU');
  });

  it('retorna 404 quando não encontrado', async () => {
    mockFetchUnifiedById.mockResolvedValueOnce(null);
    const res = await GET(makeReq(), {
      params: Promise.resolve({ id: 'inexistente' }),
    });
    expect(res.status).toBe(404);
  });
});
