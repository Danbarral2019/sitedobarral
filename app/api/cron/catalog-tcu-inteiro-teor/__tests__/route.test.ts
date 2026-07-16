// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAuth, mockFindMany, mockCount, mockCatalogar } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockCatalogar: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: (...a: unknown[]) => mockVerifyAuth(...a) }));
vi.mock('@/lib/cron-telemetry', () => ({
  withCronTelemetry: async (_n: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/tcu/catalogar-acordao', () => ({ catalogarAcordao: (...a: unknown[]) => mockCatalogar(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      count: (...a: unknown[]) => mockCount(...a),
    },
  },
}));
vi.mock('@/lib/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { GET } from '../route';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

const req = () => new NextRequest('http://localhost/api/cron/catalog-tcu-inteiro-teor');
const alvo = (id: string) => ({ id, title: `Acórdão ${id}`, tcuLinkPDF: `https://x/${id}.rtf`, leiArticlesArr: ['5'] });

describe('cron catalog-tcu-inteiro-teor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockReturnValue(null); // autenticado
    mockCount.mockResolvedValue(0);
  });

  it('sem CRON_SECRET válido: devolve o 401 do verifyCronAuth', async () => {
    const resp401 = { status: 401 } as unknown;
    mockVerifyAuth.mockReturnValue(resp401);
    const r = await GET(req());
    expect(r).toBe(resp401);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('a fila filtra por análise nula + link + tentativas < 3, com take limitado', async () => {
    mockFindMany.mockResolvedValue([]);
    await GET(req());
    const arg = mockFindMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      category: 'acordao',
      // Json null exige Prisma.DbNull — `tcuAnalise: null` casaria 0 registros.
      tcuAnalise: { equals: Prisma.DbNull },
      tcuLinkPDF: { not: null },
      tcuAnaliseTentativas: { lt: 3 },
    });
    expect(typeof arg.take).toBe('number');
    expect(arg.take).toBeGreaterThan(0);
    // prioriza quem tentou menos
    expect(arg.orderBy).toEqual([{ tcuAnaliseTentativas: 'asc' }, { id: 'asc' }]);
  });

  it('cataloga cada alvo e agrega o resultado', async () => {
    mockFindMany.mockResolvedValue([alvo('a'), alvo('b'), alvo('c')]);
    mockCatalogar
      .mockResolvedValueOnce({ status: 'ok', debatidos: ['5'] })
      .mockResolvedValueOnce({ status: 'ok-sem-secoes', debatidos: [] })
      .mockResolvedValueOnce({ status: 'falha', erro: 'timeout' });
    mockCount.mockResolvedValue(7);

    const r = await GET(req());
    const body = await r.json();

    expect(mockCatalogar).toHaveBeenCalledTimes(3);
    expect(body).toMatchObject({ processados: 3, ok: 1, semSecoes: 1, falha: 1, restamNaFila: 7 });
  });

  it('uma falha não interrompe o lote', async () => {
    mockFindMany.mockResolvedValue([alvo('a'), alvo('b')]);
    mockCatalogar
      .mockResolvedValueOnce({ status: 'falha', erro: 'x' })
      .mockResolvedValueOnce({ status: 'ok', debatidos: [] });
    const r = await GET(req());
    const body = await r.json();
    expect(mockCatalogar).toHaveBeenCalledTimes(2); // seguiu para o 2º
    expect(body.ok).toBe(1);
  });
});
