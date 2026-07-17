// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAuth, mockFindMany, mockCount, mockCatalogar } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockCatalogar: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: (...a: unknown[]) => mockVerifyAuth(...a) }));
// Achado 1: o mock precisa CAPTURAR o retorno do callback — é assim que a
// telemetria real (lib/cron-telemetry.ts) decide success/partial_failure.
// Um mock que só faz `fn()` sem guardar o retorno deixaria o bug (callback
// sem `return`) passar despercebido.
vi.mock('@/lib/cron-telemetry', () => ({
  withCronTelemetry: async (_n: string, fn: () => Promise<unknown>) => {
    const stats = await fn();
    (globalThis as { __cronStats?: unknown }).__cronStats = stats;
    return stats;
  },
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
const cronStats = () =>
  (globalThis as { __cronStats?: { itemsFound?: number; itemsNew?: number; itemsError?: number } }).__cronStats;

describe('cron catalog-tcu-inteiro-teor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockReturnValue(null); // autenticado
    mockCount.mockResolvedValue(0);
    (globalThis as { __cronStats?: unknown }).__cronStats = undefined;
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

  it('uma exceção de infraestrutura (não um status "falha") também não interrompe o lote', async () => {
    // catalogarAcordao só LANÇA em erro de infraestrutura (ex.: WebSocket do
    // Neon caiu no meio do update) — o try/catch por item existe pra isso.
    // O teste anterior só cobre resolução normal com status 'falha'; este
    // cobre a rejeição.
    mockFindMany.mockResolvedValue([alvo('a'), alvo('b'), alvo('c')]);
    mockCatalogar
      .mockResolvedValueOnce({ status: 'ok', debatidos: [] })
      .mockRejectedValueOnce(new Error('ErrorEvent: socket hang up'))
      .mockResolvedValueOnce({ status: 'ok', debatidos: [] });

    const r = await GET(req());
    const body = await r.json();

    // Tentou todos os alvos — a exceção no 2º não abortou o handler.
    expect(mockCatalogar).toHaveBeenCalledTimes(3);
    // O item que lançou é contado como falha, não derruba o lote.
    expect(body.ok).toBe(2);
    expect(body.falha).toBe(1);
    expect(body.processados).toBe(3);
  });

  it('a telemetria recebe as stats reais do lote (achado 1: callback precisa retornar)', async () => {
    mockFindMany.mockResolvedValue([alvo('a'), alvo('b'), alvo('c')]);
    mockCatalogar
      .mockResolvedValueOnce({ status: 'ok', debatidos: ['5'] })
      .mockResolvedValueOnce({ status: 'ok-sem-secoes', debatidos: [] })
      .mockResolvedValueOnce({ status: 'falha', erro: 'timeout' });
    mockCount.mockResolvedValue(7);

    await GET(req());

    const stats = cronStats();
    // Sem o `return` no callback, withCronTelemetry recebia `undefined` e
    // gravava sempre success/0/0/0 no ScraperHealthLog — mesmo com falha.
    expect(stats).toBeDefined();
    expect(stats?.itemsFound).toBe(3);
    expect(stats?.itemsNew).toBe(2); // ok + ok-sem-secoes
    expect(stats?.itemsError).toBe(1); // falha vira partial_failure no health log
  });

  it('orçamento de tempo: para o loop antes de estourar o maxDuration, deixando o resto pra próxima execução', async () => {
    mockFindMany.mockResolvedValue([alvo('a'), alvo('b'), alvo('c')]);
    mockCatalogar.mockResolvedValue({ status: 'ok', debatidos: [] });

    const nowSpy = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0) // início do orçamento
      .mockReturnValueOnce(0) // checagem antes do 1º item: dentro do orçamento
      .mockReturnValueOnce(300_000); // checagem antes do 2º item: estourou

    try {
      const r = await GET(req());
      const body = await r.json();

      // Só o 1º item foi processado; 'b' e 'c' ficam na fila (tcuAnalise
      // continua nulo) e voltam a ser selecionados no próximo run.
      expect(mockCatalogar).toHaveBeenCalledTimes(1);
      expect(body.processados).toBe(1);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
