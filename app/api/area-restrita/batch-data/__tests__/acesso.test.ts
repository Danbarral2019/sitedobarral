// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  enrollmentFindMany: vi.fn(),
  subscriptionFindMany: vi.fn(),
  documentFindMany: vi.fn(),
  videoFindMany: vi.fn(),
  siteFindMany: vi.fn(),
  moduleFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyToken: (...a: unknown[]) => mocks.verifyToken(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    enrollment: { findMany: (...a: unknown[]) => mocks.enrollmentFindMany(...a) },
    subscription: { findMany: (...a: unknown[]) => mocks.subscriptionFindMany(...a) },
    document: { findMany: (...a: unknown[]) => mocks.documentFindMany(...a) },
    courseVideo: { findMany: (...a: unknown[]) => mocks.videoFindMany(...a) },
    siteToCourse: { findMany: (...a: unknown[]) => mocks.siteFindMany(...a) },
    module: { findMany: (...a: unknown[]) => mocks.moduleFindMany(...a) },
  },
}));

import { GET } from '../route';

function req(courseIds: string) {
  const r = new NextRequest(`http://localhost/api/area-restrita/batch-data?courseIds=${courseIds}`);
  r.cookies.set('auth-token', 'tok');
  return r;
}

describe('/api/area-restrita/batch-data: acesso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.verifyToken.mockResolvedValue({ userId: 'u1', role: 'student' });
    mocks.enrollmentFindMany.mockResolvedValue([{ courseId: '2' }]);
    mocks.subscriptionFindMany.mockResolvedValue([]);
    mocks.documentFindMany.mockResolvedValue([]);
    mocks.videoFindMany.mockResolvedValue([]);
    mocks.siteFindMany.mockResolvedValue([]);
    mocks.moduleFindMany.mockResolvedValue([]);
  });

  it('não-admin só recebe os cursos com matrícula válida, mesmo pedindo outros', async () => {
    const res = await GET(req('2,3,4'));
    const corpo = await res.json();
    expect(Object.keys(corpo.data.documents)).toEqual(['2']);
    const whereDocs = mocks.documentFindMany.mock.calls[0][0].where;
    expect(whereDocs.AND[0].OR[0]).toEqual({ courseId: { in: ['2'] } });
    expect(mocks.videoFindMany.mock.calls[0][0].where.courseId).toEqual({ in: ['2'] });
    // matrícula consultada com o critério de validade
    expect(mocks.enrollmentFindMany.mock.calls[0][0].where.OR).toHaveLength(3);
  });

  it('sem acesso ativo: nenhum curso e nenhum documento comum', async () => {
    mocks.enrollmentFindMany.mockResolvedValue([]);
    const corpo = await (await GET(req('2,3'))).json();
    expect(corpo.data.documents).toEqual({});
    expect(mocks.documentFindMany).not.toHaveBeenCalled();
  });

  it('filtro de documentos exclui o grafo e condiciona o acervo comum ao acesso ativo', async () => {
    await GET(req('2'));
    const visivel = mocks.documentFindMany.mock.calls[0][0].where.AND[1];
    expect(visivel.category).toEqual({ not: 'acordao-grafo' });
    expect(visivel.OR).toContainEqual({ isCommon: true });
  });

  it('admin recebe os cursos pedidos sem filtro de visibilidade', async () => {
    mocks.verifyToken.mockResolvedValue({ userId: 'a1', role: 'admin' });
    const corpo = await (await GET(req('3,4'))).json();
    expect(Object.keys(corpo.data.documents)).toEqual(['3', '4']);
    expect(mocks.enrollmentFindMany).not.toHaveBeenCalled();
    expect(mocks.documentFindMany.mock.calls[0][0].where.AND[1]).toEqual({});
  });
});
