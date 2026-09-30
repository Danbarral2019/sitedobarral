import { describe, it, expect, vi } from 'vitest';

// auth.ts importa o prisma dinamicamente dentro das funções, mas o stub evita
// qualquer inicialização do client caso isso mude.
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { hasAccessToDocument, type DocumentAccessFields } from '../auth';

const publico: DocumentAccessFields = { isPublic: true, isCommon: false, courseId: '1', category: 'parecer' };
const restritoDeCurso: DocumentAccessFields = { isPublic: false, isCommon: false, courseId: '2', category: 'apostila' };
const restritoComum: DocumentAccessFields = { isPublic: false, isCommon: true, courseId: null, category: 'parecer' };
const grafo: DocumentAccessFields = { isPublic: false, isCommon: false, courseId: null, category: 'acordao-grafo' };

function makeDeps(over: Partial<Parameters<typeof hasAccessToDocument>[1]> = {}) {
  return {
    getUser: vi.fn().mockResolvedValue(null),
    hasCourseAccess: vi.fn().mockResolvedValue(false),
    hasAnyActiveAccess: vi.fn().mockResolvedValue(false),
    ...over,
  };
}

const aluno = { userId: 'u1', role: 'student' as const };
const admin = { userId: 'a1', role: 'admin' as const };

describe('hasAccessToDocument', () => {
  it('libera documento público sem consultar sessão nem banco', async () => {
    const deps = makeDeps();

    expect(await hasAccessToDocument(publico, deps)).toBe(true);
    expect(deps.getUser).not.toHaveBeenCalled();
    expect(deps.hasCourseAccess).not.toHaveBeenCalled();
    expect(deps.hasAnyActiveAccess).not.toHaveBeenCalled();
  });

  it('nega documento restrito a visitante sem sessão', async () => {
    const deps = makeDeps();

    expect(await hasAccessToDocument(restritoDeCurso, deps)).toBe(false);
    expect(deps.hasCourseAccess).not.toHaveBeenCalled();
  });

  it('libera qualquer documento restrito para admin, sem consultar matrícula', async () => {
    const deps = makeDeps({ getUser: vi.fn().mockResolvedValue(admin) });

    expect(await hasAccessToDocument(restritoDeCurso, deps)).toBe(true);
    expect(await hasAccessToDocument(restritoComum, deps)).toBe(true);
    expect(deps.hasCourseAccess).not.toHaveBeenCalled();
    expect(deps.hasAnyActiveAccess).not.toHaveBeenCalled();
  });

  it('delega ao acesso do curso quando o documento pertence a um curso', async () => {
    const deps = makeDeps({
      getUser: vi.fn().mockResolvedValue(aluno),
      hasCourseAccess: vi.fn().mockResolvedValue(true),
    });

    expect(await hasAccessToDocument(restritoDeCurso, deps)).toBe(true);
    expect(deps.hasCourseAccess).toHaveBeenCalledWith('2');
  });

  it('nega quando o aluno não tem acesso àquele curso', async () => {
    const deps = makeDeps({
      getUser: vi.fn().mockResolvedValue(aluno),
      hasCourseAccess: vi.fn().mockResolvedValue(false),
    });

    expect(await hasAccessToDocument(restritoDeCurso, deps)).toBe(false);
  });

  it('libera documento comum a qualquer assinante com acesso ativo', async () => {
    const deps = makeDeps({
      getUser: vi.fn().mockResolvedValue(aluno),
      hasAnyActiveAccess: vi.fn().mockResolvedValue(true),
    });

    expect(await hasAccessToDocument(restritoComum, deps)).toBe(true);
    expect(deps.hasAnyActiveAccess).toHaveBeenCalledWith('u1');
    expect(deps.hasCourseAccess).not.toHaveBeenCalled();
  });

  it('nega documento comum a usuário logado sem matrícula nem assinatura', async () => {
    const deps = makeDeps({ getUser: vi.fn().mockResolvedValue(aluno) });

    expect(await hasAccessToDocument(restritoComum, deps)).toBe(false);
  });

  // No banco de produção os 151 documentos restritos são TODOS isCommon:true, e
  // 102 deles também carregam courseId. Ali o courseId é marcador de origem, não
  // restrição: tratá-lo como restrição negaria dois terços do acervo restrito a
  // um assinante Básico de outro curso.
  it('trata isCommon como acervo comum mesmo quando há courseId preenchido', async () => {
    const comumComCurso: DocumentAccessFields = { isPublic: false, isCommon: true, courseId: '2', category: 'parecer' };
    const deps = makeDeps({
      getUser: vi.fn().mockResolvedValue(aluno),
      hasCourseAccess: vi.fn().mockResolvedValue(false),
      hasAnyActiveAccess: vi.fn().mockResolvedValue(true),
    });

    expect(await hasAccessToDocument(comumComCurso, deps)).toBe(true);
    expect(deps.hasCourseAccess).not.toHaveBeenCalled();
  });

  it('trata documento restrito sem curso e sem isCommon como acervo comum', async () => {
    const semCurso: DocumentAccessFields = { isPublic: false, isCommon: false, courseId: null, category: 'parecer' };
    const deps = makeDeps({
      getUser: vi.fn().mockResolvedValue(aluno),
      hasAnyActiveAccess: vi.fn().mockResolvedValue(true),
    });

    expect(await hasAccessToDocument(semCurso, deps)).toBe(true);
  });

  it('nega o grafo de precedentes a aluno com acesso ativo', async () => {
    const deps = makeDeps({
      getUser: vi.fn().mockResolvedValue(aluno),
      hasCourseAccess: vi.fn().mockResolvedValue(true),
      hasAnyActiveAccess: vi.fn().mockResolvedValue(true),
    });

    expect(await hasAccessToDocument(grafo, deps)).toBe(false);
    // mesmo marcado como público por engano
    expect(await hasAccessToDocument({ ...grafo, isPublic: true }, deps)).toBe(false);
  });

  it('nega o grafo a visitante anônimo mesmo marcado como público', async () => {
    const deps = makeDeps();
    expect(await hasAccessToDocument({ ...grafo, isPublic: true }, deps)).toBe(false);
  });

  it('libera o grafo para admin', async () => {
    const deps = makeDeps({ getUser: vi.fn().mockResolvedValue(admin) });
    expect(await hasAccessToDocument(grafo, deps)).toBe(true);
  });
});
