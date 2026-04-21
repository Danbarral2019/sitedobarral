// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetchUnifiedList } = vi.hoisted(() => ({
  mockFetchUnifiedList: vi.fn(),
}));

vi.mock('@/lib/jurisprudencia/unified-query', () => ({
  fetchUnifiedList: (...args: any[]) => mockFetchUnifiedList(...args),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/jurisprudencia/route';

function makeReq(qs: string): Request {
  return new Request(`http://localhost/api/jurisprudencia?${qs}`, {
    method: 'GET',
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  mockFetchUnifiedList.mockReset();
});

describe('GET /api/jurisprudencia', () => {
  it('chama fetchUnifiedList com filtros parseados e paginação default', async () => {
    mockFetchUnifiedList.mockResolvedValueOnce({ items: [], total: 0 });

    const res = await GET(makeReq('tribunal=TCU&ano=2024&tema=pregão'));
    expect(res.status).toBe(200);

    expect(mockFetchUnifiedList).toHaveBeenCalledWith(
      expect.objectContaining({
        tribunal: 'TCU',
        ano: 2024,
        tema: 'pregão',
      }),
      { page: 1, pageSize: 10 }
    );
  });

  it('retorna o shape esperado (items, total, page, pageSize, totalPages)', async () => {
    mockFetchUnifiedList.mockResolvedValueOnce({
      items: [
        {
          id: 'x',
          tribunalCode: 'TCU',
          tribunalName: 'TCU',
          decisionType: 'acordao',
          decisionNumber: 'AC-1',
          title: 'T',
          ementa: 'e',
          summary: null,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: null,
          themes: null,
          leiArticles: null,
          url: null,
        },
      ],
      total: 25,
    });

    const res = await GET(makeReq('pageSize=10&page=2'));
    const body = await readJson(res);

    expect(body).toMatchObject({
      total: 25,
      page: 2,
      pageSize: 10,
      totalPages: 3,
    });
    expect(body.items).toHaveLength(1);
  });

  it('trunca ementas longas a 300 caracteres com "..."', async () => {
    const longEmenta = 'a'.repeat(500);
    mockFetchUnifiedList.mockResolvedValueOnce({
      items: [
        {
          id: 'x',
          tribunalCode: 'TCE-SP',
          tribunalName: 'TCE-SP',
          decisionType: 'acordao',
          decisionNumber: '1',
          title: 'T',
          ementa: longEmenta,
          summary: null,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: null,
          themes: null,
          leiArticles: null,
          url: null,
        },
      ],
      total: 1,
    });

    const res = await GET(makeReq(''));
    const body = await readJson(res);
    expect(body.items[0].ementa).toHaveLength(303);
    expect(body.items[0].ementa.endsWith('...')).toBe(true);
  });

  it('rejeita tribunal desconhecido com 400', async () => {
    const res = await GET(makeReq('tribunal=INVALIDO'));
    expect(res.status).toBe(400);
  });

  it('rejeita decisionType desconhecido com 400', async () => {
    const res = await GET(makeReq('decisionType=bogus'));
    expect(res.status).toBe(400);
  });

  it('clampa pageSize no máximo 50', async () => {
    mockFetchUnifiedList.mockResolvedValueOnce({ items: [], total: 0 });
    await GET(makeReq('pageSize=500'));
    expect(mockFetchUnifiedList).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ pageSize: 50 })
    );
  });
});
