// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock('../prisma', () => ({
  prisma: { acordaoCitacao: { findMany: (...a: unknown[]) => mockFindMany(...a) } },
}));

import { colegiadoPorConvergencia } from './colegiado-por-convergencia';

const aresta = (colegiadoAlvo: string | null) => ({ colegiadoAlvo });

describe('colegiadoPorConvergencia', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta AcordaoCitacao pelo alvo, só arestas com colegiadoAlvo não-nulo', async () => {
    mockFindMany.mockResolvedValue([aresta('Plenário')]);
    await colegiadoPorConvergencia(56, 2024);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { numeroAlvo: 56, anoAlvo: 2024, colegiadoAlvo: { not: null } },
      select: { colegiadoAlvo: true },
    });
  });

  it('citantes unânimes resolvem, com a contagem de arestas que sustentam', async () => {
    mockFindMany.mockResolvedValue([aresta('Plenário'), aresta('Plenário'), aresta('Plenário')]);
    expect(await colegiadoPorConvergencia(56, 2024)).toEqual({ colegiado: 'Plenário', citantes: 3 });
  });

  it('um único citante discordante derruba para null — convergência exige unanimidade, não maioria', async () => {
    mockFindMany.mockResolvedValue([
      aresta('Plenário'), aresta('Plenário'), aresta('Plenário'), aresta('Plenário'),
      aresta('Primeira Câmara'),
    ]);
    expect(await colegiadoPorConvergencia(56, 2024)).toBeNull();
  });

  it('nenhum citante informa colegiado → null', async () => {
    mockFindMany.mockResolvedValue([]);
    expect(await colegiadoPorConvergencia(56, 2024)).toBeNull();
  });

  it('arestas com colegiado string vazia são ignoradas, não contam como convergência', async () => {
    // O Prisma filtra `not: null` no banco, mas não barra string vazia — a
    // extração por regex do grafo pode gravar ''. Sem o filtro em memória,
    // uma aresta vazia isolada "convergiria" sozinha com colegiado ''.
    mockFindMany.mockResolvedValue([aresta(''), aresta('Plenário'), aresta('Plenário')]);
    expect(await colegiadoPorConvergencia(56, 2024)).toEqual({ colegiado: 'Plenário', citantes: 2 });
  });

  it('só arestas com colegiado vazio → null (nenhuma informa de fato)', async () => {
    mockFindMany.mockResolvedValue([aresta(''), aresta('  ')]);
    expect(await colegiadoPorConvergencia(56, 2024)).toBeNull();
  });
});
