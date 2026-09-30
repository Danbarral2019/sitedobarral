// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    searchHistory: {
      findUnique: (...a: unknown[]) => mocks.findUnique(...a),
      update: (...a: unknown[]) => mocks.update(...a),
    },
  },
}));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...a: unknown[]) => mocks.getCurrentUser(...a),
}));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: async () => undefined,
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/logger', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => logger };
  return { apiLogger: logger };
});

import { POST } from '../route';

const params = { params: Promise.resolve({ id: 'sh-1' }) };

function req(body?: unknown) {
  return new NextRequest('http://localhost/api/search-history/sh-1/share', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ENTRADA = { id: 'sh-1', userId: 'u1', shareId: null, isPublic: false, respostaDoServidor: true };

describe('POST /api/search-history/[id]/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ userId: 'u1', email: 'u@x.com', role: 'student' });
    mocks.findUnique.mockResolvedValue(ENTRADA);
    mocks.update.mockResolvedValue({});
  });

  it('exige login', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await POST(req(), params);
    expect(res.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('entrada de outro usuário é 404', async () => {
    mocks.findUnique.mockResolvedValue({ ...ENTRADA, userId: 'outro' });
    const res = await POST(req(), params);
    expect(res.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('entrada cuja resposta veio do cliente não pode ser compartilhada', async () => {
    mocks.findUnique.mockResolvedValue({ ...ENTRADA, respostaDoServidor: false });
    const res = await POST(req(), params);
    expect(res.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('gera shareId de 22 caracteres e ignora resposta/fontes enviadas pelo cliente', async () => {
    const res = await POST(
      req({ aiAnswer: 'resposta forjada', sources: [{ title: 'falsa', category: 'x' }] }),
      params,
    );
    expect(res.status).toBe(200);
    const { shareId, url } = await res.json();
    expect(shareId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(url).toContain(`/busca/${shareId}`);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'sh-1' },
      data: { isPublic: true, shareId },
    });
  });

  it('reaproveita o shareId já existente', async () => {
    mocks.findUnique.mockResolvedValue({ ...ENTRADA, shareId: 'AbCdEfGhIjKlMnOpQrSt_-', isPublic: true });
    const res = await POST(req(), params);
    expect((await res.json()).shareId).toBe('AbCdEfGhIjKlMnOpQrSt_-');
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
