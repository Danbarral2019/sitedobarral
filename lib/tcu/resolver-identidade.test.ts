// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBuscar } = vi.hoisted(() => ({ mockBuscar: vi.fn() }));
vi.mock('./buscar-acordao-tcu', async () => {
  const real = await vi.importActual<typeof import('./buscar-acordao-tcu')>('./buscar-acordao-tcu');
  return { ...real, buscarAcordaoPorNumero: (...a: unknown[]) => mockBuscar(...a) };
});

import { resolverIdentidade } from './resolver-identidade';

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
      acordaoKey: 'ACORDAO-COMPLETO-1',
      colegiadoAlvo: 'Plenário',
      relatorAlvo: 'Rel X',
      urlAlvo: 'https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-1',
    });
  });

  it('dois candidatos não-relação → null por ambiguidade', async () => {
    mockBuscar.mockResolvedValue([
      cand('ACORDAO-COMPLETO-1', 'Plenário'),
      cand('ACORDAO-COMPLETO-2', 'Primeira Câmara'),
    ]);
    expect(await resolverIdentidade(56, 2024)).toBeNull();
  });

  it('nenhum candidato → null', async () => {
    mockBuscar.mockResolvedValue([]);
    expect(await resolverIdentidade(56, 2024)).toBeNull();
  });

  it('falha de rede → null, sem lançar e sem gravar identidade errada', async () => {
    mockBuscar.mockRejectedValue(new Error('ETIMEDOUT'));
    expect(await resolverIdentidade(56, 2024)).toBeNull();
  });
});
