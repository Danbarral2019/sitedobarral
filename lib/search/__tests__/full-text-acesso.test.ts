// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args) },
}));

import { searchDocuments, searchVideos } from '../full-text-search';

beforeEach(() => {
  mockQueryRawUnsafe.mockReset();
  mockQueryRawUnsafe.mockResolvedValue([]);
});

const ultimoSql = () => mockQueryRawUnsafe.mock.calls.at(-1)![0] as string;

describe('searchDocuments: acesso', () => {
  it('sem acesso ativo: só isPublic, sem isCommon nem cursos', async () => {
    await searchDocuments('dispensa', { acesso: { isAdmin: false, temAcessoAtivo: false, cursosAtivos: [] } });
    const sql = ultimoSql();
    expect(sql).toContain('"isPublic" = true');
    expect(sql).not.toContain('"isCommon" = true');
    expect(sql).not.toContain('"courseId" IN');
    expect(sql).toContain(`category <> 'acordao-grafo'`);
  });

  it('com matrícula válida: comuns e cursos ativos', async () => {
    await searchDocuments('dispensa', { acesso: { isAdmin: false, temAcessoAtivo: true, cursosAtivos: ['2'] } });
    const sql = ultimoSql();
    expect(sql).toContain('"isCommon" = true');
    expect(sql).toContain(`"courseId" IN ('2')`);
  });

  it('ignora enrolledCourseIds quando recebe acesso', async () => {
    await searchDocuments('dispensa', {
      acesso: { isAdmin: false, temAcessoAtivo: false, cursosAtivos: [] },
      enrolledCourseIds: ['9'],
    });
    expect(ultimoSql()).not.toContain(`'9'`);
  });

  it('legado (sem acesso) também exclui o grafo', async () => {
    await searchDocuments('dispensa', {});
    expect(ultimoSql()).toContain(`category <> 'acordao-grafo'`);
  });

  it('seleciona isCommon para o híbrido', async () => {
    await searchDocuments('dispensa', {});
    expect(ultimoSql()).toContain('"isCommon" as is_common');
  });
});

describe('searchVideos: falha fechada', () => {
  it('lista de cursos vazia não consulta o banco nem devolve vídeos', async () => {
    expect(await searchVideos('licitação', { enrolledCourseIds: [] })).toEqual([]);
    expect(await searchVideos('licitação')).toEqual([]);
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('com cursos, filtra por eles', async () => {
    await searchVideos('licitação', { enrolledCourseIds: ['2'] });
    expect(ultimoSql()).toContain(`"courseId" IN ('2')`);
  });
});
