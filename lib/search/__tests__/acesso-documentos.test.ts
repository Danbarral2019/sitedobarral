// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  ACESSO_ANONIMO,
  CATEGORIA_GRAFO,
  documentoVisivelSql,
  filtrarResultadosVisiveis,
  getAcessoDoUsuario,
  podeVerDocumento,
  whereDocumentoVisivel,
  type AcessoDoUsuario,
  type DocumentoVisibilidade,
} from '../acesso-documentos';
import { courses } from '@/data/courses';

const semAcesso: AcessoDoUsuario = { isAdmin: false, temAcessoAtivo: false, cursosAtivos: [] };
const alunoCurso2: AcessoDoUsuario = { isAdmin: false, temAcessoAtivo: true, cursosAtivos: ['2'] };
const admin: AcessoDoUsuario = { isAdmin: true, temAcessoAtivo: true, cursosAtivos: ['2', '3'] };

const doc = (over: Partial<DocumentoVisibilidade>): DocumentoVisibilidade => ({
  isPublic: false, isCommon: false, courseId: null, category: 'parecer', ...over,
});

describe('podeVerDocumento', () => {
  it('público é visível a todos, inclusive anônimo', () => {
    expect(podeVerDocumento(doc({ isPublic: true }), ACESSO_ANONIMO)).toBe(true);
  });

  it('comum exige acesso ativo', () => {
    expect(podeVerDocumento(doc({ isCommon: true }), semAcesso)).toBe(false);
    expect(podeVerDocumento(doc({ isCommon: true, courseId: '9' }), alunoCurso2)).toBe(true);
  });

  it('documento de curso exige acesso válido naquele curso', () => {
    expect(podeVerDocumento(doc({ courseId: '2' }), alunoCurso2)).toBe(true);
    expect(podeVerDocumento(doc({ courseId: '3' }), alunoCurso2)).toBe(false);
    expect(podeVerDocumento(doc({ courseId: '2' }), semAcesso)).toBe(false);
  });

  it('privado sem curso e não comum exige acesso ativo', () => {
    expect(podeVerDocumento(doc({}), semAcesso)).toBe(false);
    expect(podeVerDocumento(doc({}), alunoCurso2)).toBe(true);
  });

  it('acordao-grafo nunca é visível a não-admin, mesmo marcado como público', () => {
    expect(podeVerDocumento(doc({ category: CATEGORIA_GRAFO }), alunoCurso2)).toBe(false);
    expect(podeVerDocumento(doc({ category: CATEGORIA_GRAFO, isPublic: true }), alunoCurso2)).toBe(false);
    expect(podeVerDocumento(doc({ category: CATEGORIA_GRAFO }), admin)).toBe(true);
  });

  it('admin vê tudo', () => {
    expect(podeVerDocumento(doc({ courseId: '99' }), admin)).toBe(true);
  });
});

describe('whereDocumentoVisivel', () => {
  it('admin não recebe filtro', () => {
    expect(whereDocumentoVisivel(admin)).toEqual({});
  });

  it('anônimo: só públicos, fora o grafo', () => {
    expect(whereDocumentoVisivel(ACESSO_ANONIMO)).toEqual({
      category: { not: CATEGORIA_GRAFO },
      OR: [{ isPublic: true }],
    });
  });

  it('com acesso ativo: públicos, comuns, sem curso e cursos válidos', () => {
    expect(whereDocumentoVisivel(alunoCurso2)).toEqual({
      category: { not: CATEGORIA_GRAFO },
      OR: [
        { isPublic: true },
        { isCommon: true },
        { courseId: null },
        { courseId: { in: ['2'] } },
      ],
    });
  });
});

describe('documentoVisivelSql', () => {
  it('admin = TRUE', () => {
    expect(documentoVisivelSql(admin, 'd')).toBe('TRUE');
  });

  it('anônimo: só isPublic e exclui grafo', () => {
    const sql = documentoVisivelSql(ACESSO_ANONIMO, 'd');
    expect(sql).toContain(`d.category <> '${CATEGORIA_GRAFO}'`);
    expect(sql).toContain('d."isPublic" = true');
    expect(sql).not.toContain('isCommon');
    expect(sql).not.toContain('courseId');
  });

  it('escapa aspas nos ids de curso', () => {
    const sql = documentoVisivelSql({ isAdmin: false, temAcessoAtivo: true, cursosAtivos: ["x'y"] });
    expect(sql).toContain(`"courseId" IN ('x''y')`);
    expect(sql).toContain('"isCommon" = true');
  });
});

describe('filtrarResultadosVisiveis', () => {
  const base = { chunkIndex: 0, similarity: 1, documentTitle: 't', chunkContent: 'c' };
  const resultados = [
    { ...base, documentId: 'pub', sourceType: 'document', isPublic: true, isCommon: false, category: 'parecer' },
    { ...base, documentId: 'comum', sourceType: 'document', isPublic: false, isCommon: true, category: 'parecer' },
    { ...base, documentId: 'grafo', sourceType: 'document', isPublic: false, isCommon: false, category: CATEGORIA_GRAFO },
    { ...base, documentId: 'sem-ispublic', sourceType: 'document', isCommon: false, courseId: '3', category: 'parecer' },
    { ...base, documentId: 'ato', sourceType: 'legislative-act', isCommon: true, category: 'lei' },
  ];

  it('anônimo: só público e fontes não-documento', () => {
    expect(filtrarResultadosVisiveis(resultados, ACESSO_ANONIMO).map((r) => r.documentId)).toEqual(['pub', 'ato']);
  });

  it('isPublic ausente conta como privado', () => {
    const ids = filtrarResultadosVisiveis(resultados, alunoCurso2).map((r) => r.documentId);
    expect(ids).toEqual(['pub', 'comum', 'ato']);
  });

  it('admin recebe tudo', () => {
    expect(filtrarResultadosVisiveis(resultados, admin)).toHaveLength(resultados.length);
  });
});

describe('getAcessoDoUsuario', () => {
  function deps(matriculas: Array<{ courseId: string }>, assinaturas: Array<{ plan: string; courseId: string | null }>) {
    return {
      prisma: {
        enrollment: { findMany: vi.fn().mockResolvedValue(matriculas) },
        subscription: { findMany: vi.fn().mockResolvedValue(assinaturas) },
      },
    };
  }

  it('anônimo', async () => {
    expect(await getAcessoDoUsuario(null)).toEqual(ACESSO_ANONIMO);
  });

  it('admin não consulta o banco', async () => {
    const d = deps([], []);
    const acesso = await getAcessoDoUsuario({ userId: 'a', role: 'admin' }, d);
    expect(acesso.isAdmin).toBe(true);
    expect(d.prisma.enrollment.findMany).not.toHaveBeenCalled();
  });

  it('filtra matrículas pelo critério de validade', async () => {
    const d = deps([{ courseId: '2' }], []);
    const acesso = await getAcessoDoUsuario({ userId: 'u', role: 'student' }, d);
    expect(acesso).toEqual({ isAdmin: false, temAcessoAtivo: true, cursosAtivos: ['2'] });
    const where = d.prisma.enrollment.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u');
    expect(where.OR).toEqual([
      { isLifetime: true },
      { expiresAt: null },
      { expiresAt: { gt: expect.any(Date) } },
    ]);
  });

  it('sem matrícula válida nem assinatura: sem acesso', async () => {
    const acesso = await getAcessoDoUsuario({ userId: 'u', role: 'student' }, deps([], []));
    expect(acesso).toEqual({ isAdmin: false, temAcessoAtivo: false, cursosAtivos: [] });
  });

  it('assinatura premium cobre todos os cursos; básica, o seu', async () => {
    const premium = await getAcessoDoUsuario({ userId: 'u', role: 'student' }, deps([], [{ plan: 'premium', courseId: null }]));
    expect(premium.cursosAtivos.sort()).toEqual(courses.map((c) => c.id).sort());
    const basico = await getAcessoDoUsuario({ userId: 'u', role: 'student' }, deps([], [{ plan: 'basico', courseId: '4' }]));
    expect(basico).toEqual({ isAdmin: false, temAcessoAtivo: true, cursosAtivos: ['4'] });
  });
});
