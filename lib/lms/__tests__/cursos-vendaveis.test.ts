// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGroupBy, mockFindMany } = vi.hoisted(() => ({
  mockGroupBy: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lesson: { groupBy: mockGroupBy },
    module: { findMany: mockFindMany },
  },
}));

vi.mock('@/data/courses', () => ({
  courses: [
    { id: '2', title: 'Planejamento das Contratações' },
    { id: '3', title: 'Gestão e Fiscalização' },
    { id: '4', title: 'Processo Administrativo Sancionador' },
    { id: '10', title: 'Contratação Direta' },
  ],
}));

import { listarCursosVendaveis } from '../cursos-vendaveis';

beforeEach(() => {
  mockGroupBy.mockReset();
  mockFindMany.mockReset();
});

describe('listarCursosVendaveis', () => {
  it('devolve só os cursos que têm ao menos uma aula', async () => {
    mockGroupBy.mockResolvedValue([{ moduleId: 'm1' }, { moduleId: 'm2' }]);
    mockFindMany.mockResolvedValue([{ courseId: '2' }, { courseId: '10' }]);

    expect(await listarCursosVendaveis()).toEqual([
      { id: '2', name: 'Planejamento das Contratações' },
      { id: '10', name: 'Contratação Direta' },
    ]);
  });

  // O curso 4 tem um módulo e nenhuma aula. Vender a escolha dele no plano
  // Básico é cobrar por uma sala vazia.
  it('exclui curso que tem módulo mas nenhuma aula', async () => {
    mockGroupBy.mockResolvedValue([{ moduleId: 'm1' }]);
    mockFindMany.mockResolvedValue([{ courseId: '3' }]);

    const ids = (await listarCursosVendaveis()).map((c) => c.id);
    expect(ids).toEqual(['3']);
    expect(ids).not.toContain('4');
  });

  it('preserva a ordem de data/courses, não a do banco', async () => {
    mockGroupBy.mockResolvedValue([{ moduleId: 'm1' }, { moduleId: 'm2' }]);
    mockFindMany.mockResolvedValue([{ courseId: '10' }, { courseId: '2' }]);

    expect((await listarCursosVendaveis()).map((c) => c.id)).toEqual(['2', '10']);
  });

  it('devolve lista vazia quando não há nenhuma aula, sem consultar módulos', async () => {
    mockGroupBy.mockResolvedValue([]);

    expect(await listarCursosVendaveis()).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('ignora aulas de curso que não está na vitrine', async () => {
    mockGroupBy.mockResolvedValue([{ moduleId: 'm1' }]);
    mockFindMany.mockResolvedValue([{ courseId: '99' }]);

    expect(await listarCursosVendaveis()).toEqual([]);
  });
});
