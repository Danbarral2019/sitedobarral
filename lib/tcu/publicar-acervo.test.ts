// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnunciados } = vi.hoisted(() => ({ mockEnunciados: vi.fn() }));
vi.mock('../prisma', () => ({
  prisma: { teseEnunciado: { findMany: (...a: unknown[]) => mockEnunciados(...a) } },
}));

import { selecionarParaPublicar } from './publicar-acervo';

const enunciado = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  trechosFonte: [0],
  trechos: [{ ordem: 0, origemDocumentId: 'd1', origemUrl: null, origemLinkPDF: null }],
  ...over,
});

describe('selecionarParaPublicar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta usando o predicado canônico e publicado false', async () => {
    mockEnunciados.mockResolvedValue([]);
    await selecionarParaPublicar();
    const where = mockEnunciados.mock.calls[0][0].where;
    expect(where.veredito).toBe('fiel');
    expect(where.retiradoEm).toBeNull();
    expect(where.publicado).toBe(false);
  });

  it('publica o enunciado com evidência íntegra', async () => {
    mockEnunciados.mockResolvedValue([enunciado()]);
    const r = await selecionarParaPublicar();
    expect(r.publicaveis).toEqual(['e1']);
  });

  it('exclui evidência incompleta e conta o motivo', async () => {
    // declara dois índices, só um persistido
    mockEnunciados.mockResolvedValue([enunciado({ trechosFonte: [0, 1] })]);
    const r = await selecionarParaPublicar();
    expect(r.publicaveis).toEqual([]);
    expect(r.foraPorMotivo['evidência incompleta']).toBe(1);
  });

  it('exclui trecho sem caminho para o inteiro teor', async () => {
    mockEnunciados.mockResolvedValue([
      enunciado({ trechos: [{ ordem: 0, origemDocumentId: null, origemUrl: null, origemLinkPDF: null }] }),
    ]);
    const r = await selecionarParaPublicar();
    expect(r.publicaveis).toEqual([]);
    expect(r.foraPorMotivo['evidência incompleta']).toBe(1);
  });
});
