// @vitest-environment node
import { it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyToken, mockHybridSearch, mockUserFind, mockDocFind, mockActFind } = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
  mockHybridSearch: vi.fn(),
  mockUserFind: vi.fn(),
  mockDocFind: vi.fn(),
  mockActFind: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyToken: (...a: unknown[]) => mockVerifyToken(...a) }));
vi.mock('@/lib/embeddings/hybrid-search', () => ({ hybridSearch: (...a: unknown[]) => mockHybridSearch(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFind(...a) },
    document: { findMany: (...a: unknown[]) => mockDocFind(...a) },
    legislativeAct: { findMany: (...a: unknown[]) => mockActFind(...a) },
  },
}));
vi.mock('@/lib/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { GET } from '../route';
import { NextRequest } from 'next/server';

function req(q: string) {
  const r = new NextRequest(`http://localhost/api/area-restrita/global-search/hybrid?q=${encodeURIComponent(q)}`);
  r.cookies.set('auth-token', 'tok');
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyToken.mockResolvedValue({ userId: 'u1', role: 'student' });
  mockUserFind.mockResolvedValue({ id: 'u1', enrollments: [{ courseId: '3' }] });
  mockDocFind.mockResolvedValue([]);
  mockActFind.mockResolvedValue([]);
});

it('remove documento de curso não-matriculado (acesso) e retorna só os permitidos', async () => {
  mockHybridSearch.mockResolvedValue({ results: [
    { documentId: 'd-ok', category: 'apostila', similarity: 0.9, isCommon: false, courseId: '3', sourceType: 'document' },
    { documentId: 'd-leak', category: 'apostila', similarity: 0.8, isCommon: false, courseId: '99', sourceType: 'document' },
  ] });
  mockDocFind.mockResolvedValue([
    { id: 'd-ok', title: 'OK', description: null, category: 'apostila', type: 'm', url: null, courseId: '3', tags: null, uploadedAt: new Date(), isPublic: false },
  ]);

  const res = await GET(req('dispensa'));
  const body = await res.json();
  expect(res.status).toBe(200);
  const ids = body.results.map((r: { data: { id: string } }) => r.data.id);
  expect(ids).toContain('d-ok');
  expect(ids).not.toContain('d-leak');
  // só pediu hidratação dos IDs permitidos
  expect(mockDocFind).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['d-ok'] } } }));
});

it('401 quando não autenticado', async () => {
  mockVerifyToken.mockResolvedValue(null);
  const res = await GET(req('dispensa'));
  expect(res.status).toBe(401);
});

it('fallback: hybridSearch lança → responde 200 com results vazio (nunca quebra a lista)', async () => {
  mockHybridSearch.mockRejectedValue(new Error('boom'));
  const res = await GET(req('dispensa'));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.results).toEqual([]);
});

it('preserva a ordem de relevância do híbrido (após dedupe/hidratação)', async () => {
  mockHybridSearch.mockResolvedValue({ results: [
    { documentId: 'd2', category: 'apostila', similarity: 0.95, isCommon: true, sourceType: 'document' },
    { documentId: 'd1', category: 'apostila', similarity: 0.90, isCommon: true, sourceType: 'document' },
  ] });
  mockDocFind.mockResolvedValue([
    { id: 'd1', title: 'D1', description: null, category: 'apostila', type: 'm', url: null, courseId: null, tags: null, uploadedAt: new Date(), isPublic: true },
    { id: 'd2', title: 'D2', description: null, category: 'apostila', type: 'm', url: null, courseId: null, tags: null, uploadedAt: new Date(), isPublic: true },
  ]);
  const res = await GET(req('dispensa'));
  const body = await res.json();
  expect(body.results.map((r: { data: { id: string } }) => r.data.id)).toEqual(['d2', 'd1']);
});
