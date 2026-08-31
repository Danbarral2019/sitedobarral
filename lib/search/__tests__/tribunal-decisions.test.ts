// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args) },
}));

import { searchTribunalDecisions } from '../full-text-search';

beforeEach(() => {
  mockQueryRawUnsafe.mockReset();
  mockQueryRawUnsafe.mockResolvedValue([]);
});

async function sqlDaBusca(termo = 'licitação'): Promise<string> {
  await searchTribunalDecisions(termo);
  return mockQueryRawUnsafe.mock.calls[0][0] as string;
}

describe('searchTribunalDecisions', () => {
  it('não consulta o banco com termo vazio', async () => {
    expect(await searchTribunalDecisions('   ')).toEqual([]);
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  // Os acórdãos do TCU já chegam por searchDocuments. Incluí-los aqui traria
  // cada um duas vezes — a duplicação corrigida em unified-query.
  it('exclui o TCU, que já vem pelos documentos', async () => {
    expect(await sqlDaBusca()).toMatch(/"tribunalCode" NOT IN \([^)]*'TCU'/);
  });

  // 1.349 súmulas trabalhistas, fora do tema de licitações.
  it('exclui as súmulas do TST', async () => {
    expect(await sqlDaBusca()).toMatch(/"tribunalCode" NOT IN \([^)]*'TST'/);
  });

  it('aplica o mesmo portão de curadoria da listagem', async () => {
    const sql = await sqlDaBusca();
    expect(sql).toMatch(/"isRelevant" = true/);
    expect(sql).toMatch(/"approvalStatus" IN \('auto_approved', 'manually_approved'\)/);
  });

  it('ordena por relevância e depois por data de julgamento', async () => {
    expect(await sqlDaBusca()).toMatch(/ORDER BY rank DESC, "dataJulgamento" DESC NULLS LAST/);
  });

  it('passa o termo sanitizado como parâmetro, não interpolado no SQL', async () => {
    await searchTribunalDecisions('dispensa de licitação');
    const [sql, param] = mockQueryRawUnsafe.mock.calls[0];
    expect(param).toBe('dispensa de licitação');
    expect(sql).not.toContain('dispensa de licitação');
  });

  it('devolve o rank de cada linha junto do dado', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { id: 'td-1', tribunal_code: 'TCE-PE', rank: 0.77 },
    ]);
    const out = await searchTribunalDecisions('licitação');
    expect(out).toEqual([
      { data: { id: 'td-1', tribunal_code: 'TCE-PE', rank: 0.77 }, rank: 0.77 },
    ]);
  });

  it('respeita o limite pedido', async () => {
    await searchTribunalDecisions('licitação', { limit: 12 });
    expect(mockQueryRawUnsafe.mock.calls[0][0]).toMatch(/LIMIT 12/);
  });
});
