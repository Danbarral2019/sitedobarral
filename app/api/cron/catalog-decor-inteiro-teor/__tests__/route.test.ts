// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAuth, mockSelecionar, mockContar, mockCapturar } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockSelecionar: vi.fn(),
  mockContar: vi.fn(),
  mockCapturar: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: (...a: unknown[]) => mockVerifyAuth(...a) }));
// Captura o retorno do callback: é por ele que a telemetria real decide
// success/partial_failure.
vi.mock('@/lib/cron-telemetry', () => ({
  withCronTelemetry: async (_n: string, fn: () => Promise<unknown>) => {
    const stats = await fn();
    (globalThis as { __cronStats?: unknown }).__cronStats = stats;
    return stats;
  },
}));
vi.mock('@/lib/agu/inteiro-teor-decor', () => ({
  selecionarFilaDecor: (...a: unknown[]) => mockSelecionar(...a),
  contarFilaDecor: (...a: unknown[]) => mockContar(...a),
  capturarInteiroTeorDecor: (...a: unknown[]) => mockCapturar(...a),
}));
vi.mock('@/lib/prisma', () => ({ prisma: { document: {} } }));
vi.mock('@/lib/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { GET } from '../route';
import { NextRequest } from 'next/server';

const req = () => new NextRequest('http://localhost/api/cron/catalog-decor-inteiro-teor');
const alvo = (id: string) => ({ id, title: `Parecer ${id}`, url: `https://cgu.agu.gov.br/decor/arquivos/${id}.pdf` });
const cronStats = () =>
  (globalThis as { __cronStats?: { itemsFound?: number; itemsNew?: number; itemsError?: number } }).__cronStats;

describe('cron catalog-decor-inteiro-teor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    mockVerifyAuth.mockReturnValue(null);
    mockContar.mockResolvedValue(0);
    (globalThis as { __cronStats?: unknown }).__cronStats = undefined;
  });

  /** Roda o GET avançando os timers da pausa entre downloads. */
  async function rodar() {
    const p = GET(req());
    await vi.runAllTimersAsync();
    const r = await p;
    vi.useRealTimers();
    return r;
  }

  it('sem CRON_SECRET válido: devolve o 401 e não toca na fila', async () => {
    const resp401 = { status: 401 } as unknown;
    mockVerifyAuth.mockReturnValue(resp401);
    expect(await GET(req())).toBe(resp401);
    expect(mockSelecionar).not.toHaveBeenCalled();
  });

  it('pede um lote limitado da fila', async () => {
    mockSelecionar.mockResolvedValue([]);
    await rodar();
    const opts = mockSelecionar.mock.calls[0][1];
    expect(opts.take).toBeGreaterThan(0);
    expect(opts.take).toBeLessThanOrEqual(30);
  });

  it('processa o lote, conta ok/falha e devolve as stats à telemetria', async () => {
    mockSelecionar.mockResolvedValue([alvo('a'), alvo('b'), alvo('c')]);
    mockCapturar
      .mockResolvedValueOnce({ status: 'ok', chars: 40000, truncado: false })
      .mockResolvedValueOnce({ status: 'falha', erro: 'HTTP 404' })
      .mockResolvedValueOnce({ status: 'ok', chars: 500000, truncado: true });
    mockContar.mockResolvedValue(7);

    const r = await rodar();
    const body = await r.json();

    expect(mockCapturar).toHaveBeenCalledTimes(3);
    expect(body).toEqual({ processados: 3, ok: 2, falha: 1, truncados: 1, restamNaFila: 7 });
    expect(cronStats()).toMatchObject({ itemsFound: 3, itemsNew: 2, itemsError: 1 });
  });

  it('erro inesperado num item (ex.: banco) não aborta o lote', async () => {
    mockSelecionar.mockResolvedValue([alvo('a'), alvo('b')]);
    mockCapturar.mockRejectedValueOnce(new Error('WebSocket closed')).mockResolvedValueOnce({ status: 'ok', chars: 10 });

    const body = await (await rodar()).json();
    expect(mockCapturar).toHaveBeenCalledTimes(2);
    expect(body).toMatchObject({ processados: 2, ok: 1, falha: 1 });
  });
});
