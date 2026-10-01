// @vitest-environment node
/**
 * /api/admin/dou/approve no padrão da Fase 8: os erros semânticos mantêm o
 * status de antes (401, 400, 404, 409) e a mensagem em `error`, que o
 * use-dou-filtros mostra no toast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockVerifyAuth = vi.fn();
vi.mock('@/lib/auth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }));

const mockStagingFind = vi.fn();
const mockDocumentFindFirst = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dOUStagingDocument: { findUnique: (...a: unknown[]) => mockStagingFind(...a) },
    document: { findFirst: (...a: unknown[]) => mockDocumentFindFirst(...a) },
  },
}));

vi.mock('@/lib/cache/redis-client', () => ({ CacheInvalidation: {} }));
vi.mock('@/lib/lei-articles', () => ({ setLeiArticles: vi.fn() }));

import { POST } from '../route';

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/dou/approve', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const ADMIN = { valid: true, user: { userId: 'a1', role: 'admin', email: 'admin@x' } };

describe('/api/admin/dou/approve: erros', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockVerifyAuth.mockResolvedValue(ADMIN);
  });

  it('401 para quem não é admin', async () => {
    mockVerifyAuth.mockResolvedValue({ valid: true, user: { userId: 'u', role: 'student' } });
    const res = await POST(req({ documentId: 'd1', action: 'reject' }));
    expect(res.status).toBe(401);
  });

  it('400 com ação inválida', async () => {
    const res = await POST(req({ documentId: 'd1', action: 'apagar' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('action deve ser "approve" ou "reject"');
  });

  it('404 quando o documento não está no staging', async () => {
    mockStagingFind.mockResolvedValue(null);
    const res = await POST(req({ documentId: 'd1', action: 'reject' }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('NOT_FOUND');
  });

  it('409 quando o documento já foi decidido, com a decisão em details', async () => {
    mockStagingFind.mockResolvedValue({
      id: 'd1',
      finalDecision: 'approved',
      reviewedBy: 'outro@x',
      reviewedAt: null,
    });
    const res = await POST(req({ documentId: 'd1', action: 'reject' }));
    expect(res.status).toBe(409);
    const corpo = await res.json();
    expect(corpo.error).toBe('Documento já foi aprovado anteriormente');
    expect(corpo.details).toMatchObject({ decision: 'approved', reviewedBy: 'outro@x' });
  });

  it('409 na aprovação de documento que já existe no acervo', async () => {
    mockStagingFind.mockResolvedValue({ id: 'd1', finalDecision: null, url: 'https://dou/x' });
    mockDocumentFindFirst.mockResolvedValue({ id: 'doc-9' });
    const res = await POST(req({ documentId: 'd1', action: 'approve', courseIds: ['2'] }));
    expect(res.status).toBe(409);
    const corpo = await res.json();
    expect(corpo.error).toBe('Documento já existe no acervo');
    expect(corpo.details).toEqual({ existingDocumentId: 'doc-9' });
  });
});
