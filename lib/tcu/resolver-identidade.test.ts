// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBuscar, mockUpsert } = vi.hoisted(() => ({ mockBuscar: vi.fn(), mockUpsert: vi.fn() }));
vi.mock('./buscar-acordao-tcu', async () => {
  const real = await vi.importActual<typeof import('./buscar-acordao-tcu')>('./buscar-acordao-tcu');
  return { ...real, buscarAcordaoPorNumero: (...a: unknown[]) => mockBuscar(...a) };
});
vi.mock('../prisma', () => ({
  prisma: { alvoIdentidadeIrresolvida: { upsert: (...a: unknown[]) => mockUpsert(...a) } },
}));

import { resolverIdentidade, registrarIdentidadeIrresolvida } from './resolver-identidade';

const cand = (key: string, colegiado: string, isRelacao = false) => ({
  numero: 56, ano: 2024, colegiado, relator: 'Rel X', ementa: '', key,
  link: `https://pesquisa.apps.tcu.gov.br/documento/${key.toLowerCase()}`, isRelacao,
});

describe('resolverIdentidade', () => {
  beforeEach(() => vi.clearAllMocks());

  it('candidato único resolve com key, colegiado, relator e url', async () => {
    mockBuscar.mockResolvedValue([cand('ACORDAO-COMPLETO-1', 'Plenário')]);
    const r = await resolverIdentidade(56, 2024);
    expect(r).toEqual({
      tipo: 'resolvido',
      identidade: {
        acordaoKey: 'ACORDAO-COMPLETO-1',
        colegiadoAlvo: 'Plenário',
        relatorAlvo: 'Rel X',
        urlAlvo: 'https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-1',
      },
    });
  });

  it('dois candidatos não-relação → ambíguo, com a contagem de candidatos', async () => {
    mockBuscar.mockResolvedValue([
      cand('ACORDAO-COMPLETO-1', 'Plenário'),
      cand('ACORDAO-COMPLETO-2', 'Primeira Câmara'),
    ]);
    expect(await resolverIdentidade(56, 2024)).toEqual({ tipo: 'ambiguo', candidatos: 2 });
  });

  it('nenhum candidato → não encontrado', async () => {
    mockBuscar.mockResolvedValue([]);
    expect(await resolverIdentidade(56, 2024)).toEqual({ tipo: 'naoEncontrado' });
  });

  it('só candidatos de relação (sem acórdão completo) → não encontrado', async () => {
    mockBuscar.mockResolvedValue([cand('ACORDAO-COMPLETO-1', 'Plenário', true)]);
    expect(await resolverIdentidade(56, 2024)).toEqual({ tipo: 'naoEncontrado' });
  });

  it('falha de rede → erro transitório, sem lançar e sem gravar identidade errada', async () => {
    mockBuscar.mockRejectedValue(new Error('ETIMEDOUT'));
    expect(await resolverIdentidade(56, 2024)).toEqual({ tipo: 'erroTransitorio', erro: 'ETIMEDOUT' });
    // erroTransitorio é passageiro (spec 2026-09-04): NUNCA deve ser gravado
    // no sumidouro — quem chama resolverIdentidade não tem como confundir os
    // dois porque o tipo do retorno já distingue. Aqui confirmamos que o
    // próprio resolverIdentidade não grava nada em nenhum caso — quem decide
    // é sempre o chamador, explicitamente, via registrarIdentidadeIrresolvida.
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

// ── registrarIdentidadeIrresolvida — sumidouro do cron (spec 2026-09-04) ──

describe('registrarIdentidadeIrresolvida', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grava com tentativas: 1 na primeira ocorrência (create do upsert)', async () => {
    mockUpsert.mockResolvedValue({});
    await registrarIdentidadeIrresolvida(56, 2024, 'naoEncontrado');

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { numeroAlvo_anoAlvo: { numeroAlvo: 56, anoAlvo: 2024 } },
      create: { numeroAlvo: 56, anoAlvo: 2024, chave: '56/2024', resultado: 'naoEncontrado', candidatos: null, tentativas: 1 },
      update: { resultado: 'naoEncontrado', candidatos: null, tentativas: { increment: 1 } },
    });
  });

  it('grava candidatos quando ambíguo', async () => {
    mockUpsert.mockResolvedValue({});
    await registrarIdentidadeIrresolvida(56, 2024, 'ambiguo', 3);

    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.create.candidatos).toBe(3);
    expect(arg.update.candidatos).toBe(3);
  });

  it('numa segunda ocorrência, o upsert pede increment de tentativas — não reset para 1', async () => {
    // O Prisma real, sob a hood, faz o UPDATE quando a linha já existe — o
    // teste confirma que o payload pedido é um increment (não um valor fixo),
    // que é o que faz `tentativas` acumular ao longo de execuções repetidas.
    mockUpsert.mockResolvedValue({});
    await registrarIdentidadeIrresolvida(56, 2024, 'ambiguo', 2);
    await registrarIdentidadeIrresolvida(56, 2024, 'ambiguo', 2);

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    for (const call of mockUpsert.mock.calls) {
      expect(call[0].update.tentativas).toEqual({ increment: 1 });
    }
  });
});
