// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetchUnifiedById, mockDocFindUnique } = vi.hoisted(() => ({
  mockFetchUnifiedById: vi.fn(),
  mockDocFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findUnique: (...a: unknown[]) => mockDocFindUnique(...a) },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    subscription: { findMany: vi.fn().mockResolvedValue([]) },
  },
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
  mockDocFindUnique.mockReset();
  mockDocFindUnique.mockResolvedValue({ isPublic: true, isCommon: false, courseId: null, category: 'acordao' });
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

  it('acórdão do acervo restrito: anônimo recebe sem inteiro teor nem resumo', async () => {
    mockFetchUnifiedById.mockResolvedValueOnce({
      id: 'doc-r', tribunalCode: 'TCU', sourceType: 'document-tcu',
      ementa: 'ementa', fullText: 'inteiro teor', summary: 'resumo',
    });
    mockDocFindUnique.mockResolvedValueOnce({ isPublic: false, isCommon: true, courseId: null, category: 'acordao' });
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'doc-r' }) });
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.ementa).toBe('ementa');
    expect(body.fullText).toBeNull();
    expect(body.summary).toBeNull();
    expect(body.acessoRestrito).toBe(true);
  });

  it('acórdão público: inteiro teor liberado', async () => {
    mockFetchUnifiedById.mockResolvedValueOnce({
      id: 'doc-p', tribunalCode: 'TCU', sourceType: 'document-tcu', fullText: 'inteiro teor',
    });
    const body = await readJson(await GET(makeReq(), { params: Promise.resolve({ id: 'doc-p' }) }));
    expect(body.fullText).toBe('inteiro teor');
  });
});
