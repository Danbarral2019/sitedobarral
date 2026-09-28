// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockDeleteMany, mockProcess } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockProcess: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teseEnunciado: { findMany: mockFindMany },
    teseEnunciadoChunk: { deleteMany: mockDeleteMany },
  },
}));
vi.mock('../tese-processor', () => ({ processTeseEnunciado: mockProcess }));

import { reconciliarTeses } from '../tese-reconciliacao';

/** Enunciado que passa no predicado base, com evidência íntegra. */
function candidato(id: string, opcoes: { comChunk?: boolean; trechosFonte?: number[] } = {}) {
  return {
    id,
    trechosFonte: opcoes.trechosFonte ?? [0],
    trechos: [{ ordem: 0, origemDocumentId: null, origemUrl: 'https://tcu', origemLinkPDF: null }],
    chunk: opcoes.comChunk ? { id: `chunk-${id}` } : null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteMany.mockResolvedValue({ count: 0 });
});

describe('reconciliarTeses', () => {
  it('indexa os elegíveis que ainda não têm chunk', async () => {
    mockFindMany.mockResolvedValue([candidato('e1'), candidato('e2'), candidato('e3', { comChunk: true })]);
    mockProcess.mockResolvedValue({ success: true, enunciadoId: 'x' });
    const r = await reconciliarTeses();
    expect(r.indexados).toBe(2);
    expect(mockProcess.mock.calls.map((c) => c[0])).toEqual(['e1', 'e2']);
  });

  it('respeita o tamanho do lote', async () => {
    mockFindMany.mockResolvedValue([candidato('e1'), candidato('e2'), candidato('e3')]);
    mockProcess.mockResolvedValue({ success: true, enunciadoId: 'x' });
    const r = await reconciliarTeses({ limite: 2 });
    expect(r.indexados).toBe(2);
  });

  // O processador recusaria o enunciado de evidência incompleta sem criar
  // chunk. Se ele entrasse na fila, voltaria a ela a cada rodada e acabaria
  // ocupando o lote das teses válidas.
  it('não põe na fila o enunciado com evidência incompleta', async () => {
    mockFindMany.mockResolvedValue([candidato('e1', { trechosFonte: [0, 1] }), candidato('e2')]);
    mockProcess.mockResolvedValue({ success: true, enunciadoId: 'x' });
    await reconciliarTeses({ limite: 1 });
    expect(mockProcess.mock.calls.map((c) => c[0])).toEqual(['e2']);
  });

  // A garantia central da §9: quem perdeu elegibilidade some do índice.
  //
  // ATENÇÃO ao alcance deste teste. O Prisma aqui é um dublê: ele anota que a
  // ordem de apagar foi dada, com qual lista de preservados, e devolve o número
  // que o próprio teste mandou devolver. Nenhuma linha existe, nenhum SQL roda.
  // Ele prova que o código pede a coisa certa; NÃO prova que o banco apaga as
  // linhas certas. Quem prova isso é e2e/teses-reconciliacao.spec.ts.
  it('preserva os chunks das teses válidas e apaga o resto', async () => {
    mockFindMany.mockResolvedValue([
      candidato('e1', { comChunk: true }),
      candidato('e2', { comChunk: true }),
      // Perdeu a integralidade depois de indexada: o chunk tem de sair.
      candidato('e3', { comChunk: true, trechosFonte: [0, 1] }),
    ]);
    mockDeleteMany.mockResolvedValue({ count: 3 });
    const r = await reconciliarTeses();
    expect(r.apagados).toBe(3);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { enunciadoId: { notIn: ['e1', 'e2'] } },
    });
  });

  it('conta falha sem derrubar o lote', async () => {
    mockFindMany.mockResolvedValue([candidato('e1'), candidato('e2')]);
    mockProcess
      .mockResolvedValueOnce({ success: false, enunciadoId: 'e1', error: 'quota' })
      .mockResolvedValueOnce({ success: true, enunciadoId: 'e2' });
    const r = await reconciliarTeses();
    expect(r).toMatchObject({ indexados: 1, falhas: 1 });
  });
});
