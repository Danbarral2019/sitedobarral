// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: { searchHistory: { findFirst: (...a: unknown[]) => mocks.findFirst(...a) } },
}));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: async () => undefined,
  getClientIp: () => '127.0.0.1',
}));

import { GET } from '../route';

const SHARE_22 = 'AbCdEfGhIjKlMnOpQrSt_-';

function get(shareId: string) {
  return GET(new NextRequest(`http://localhost/api/search-history/share/${shareId}`), {
    params: Promise.resolve({ shareId }),
  });
}

describe('GET /api/search-history/share/[shareId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('link antigo de 8 caracteres responde 404 sem consultar o banco', async () => {
    const res = await get('abcd1234');
    expect(res.status).toBe(404);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('shareId novo inexistente ou sem resposta do servidor responde 404', async () => {
    mocks.findFirst.mockResolvedValue(null);
    const res = await get(SHARE_22);
    expect(res.status).toBe(404);
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({
      shareId: SHARE_22,
      isPublic: true,
      respostaDoServidor: true,
    });
  });

  it('devolve o que o servidor gravou', async () => {
    mocks.findFirst.mockResolvedValue({
      query: 'dispensa',
      aiAnswer: 'resposta',
      sources: JSON.stringify([{ title: 'Doc', category: 'apostila' }]),
      legalSources: null,
      createdAt: new Date('2026-09-30T12:00:00Z'),
    });
    const res = await get(SHARE_22);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      query: 'dispensa',
      aiAnswer: 'resposta',
      sources: [{ title: 'Doc', category: 'apostila' }],
      legalSources: [],
    });
  });
});
