// @vitest-environment node
/**
 * Regressão: o filtro `isPublic` da Lei 14.133 Comentada.
 *
 * Bug original (auditoria 2026-07-15): o `where` aplicava
 * `...(!isAuthenticated && { isPublic: true })` — ou seja, o filtro de
 * documentos privados só valia para visitantes ANÔNIMOS. Qualquer usuário
 * logado (inclusive aluno comum) recebia os 60 documentos `isPublic=false`
 * vinculados a artigos, que eram exatamente os 55 registros-fantasma de ON
 * (sem content e sem url → link quebrado) + 5 documentos de teste
 * (`url="#teste-..."`).
 *
 * Regra correta: só ADMIN vê documento privado. Aluno logado e anônimo, não.
 *
 * Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAuth, mockDocumentFindMany, mockLegislativeActFindMany } = vi.hoisted(() => ({
  mockVerifyAuth: vi.fn(),
  mockDocumentFindMany: vi.fn(),
  mockLegislativeActFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: (...args: unknown[]) => mockDocumentFindMany(...args) },
    legislativeAct: { findMany: (...args: unknown[]) => mockLegislativeActFindMany(...args) },
  },
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';

const req = () => new NextRequest('http://localhost/api/lei-14133/article-docs/5');
const ctx = { params: Promise.resolve({ numero: '5' }) };

/** Extrai o `where` passado ao document.findMany. */
const whereArg = () => mockDocumentFindMany.mock.calls[0]?.[0]?.where;

describe('article-docs — filtro isPublic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocumentFindMany.mockResolvedValue([]);
    mockLegislativeActFindMany.mockResolvedValue([]);
  });

  it('anônimo: filtra por isPublic', async () => {
    mockVerifyAuth.mockResolvedValue({ valid: false });
    await GET(req(), ctx);
    expect(whereArg()).toMatchObject({ isPublic: true });
  });

  it('ALUNO logado: NÃO pode ver documento privado', async () => {
    mockVerifyAuth.mockResolvedValue({
      valid: true,
      user: { userId: 'u1', email: 'aluno@teste.com', role: 'student' },
    });
    await GET(req(), ctx);
    // Antes da correção este where NÃO tinha isPublic → vazava os 60 registros ruins.
    expect(whereArg()).toMatchObject({ isPublic: true });
  });

  it('ADMIN: vê tudo (curadoria)', async () => {
    mockVerifyAuth.mockResolvedValue({
      valid: true,
      user: { userId: 'a1', email: 'admin@teste.com', role: 'admin' },
    });
    await GET(req(), ctx);
    expect(whereArg()).not.toHaveProperty('isPublic');
  });
});

describe('article-docs — categorias-substrato', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocumentFindMany.mockResolvedValue([]);
    mockLegislativeActFindMany.mockResolvedValue([]);
  });

  // Os 183 registros `lei-artigo` são o texto da própria Lei, criados como
  // substrato de busca. Apareciam em "Outros Documentos" como se fossem
  // documentos vinculados ao artigo — inclusive o artigo vinculado a si mesmo.
  it.each([
    ['anônimo', { valid: false }],
    ['admin', { valid: true, user: { userId: 'a1', email: 'a@b.c', role: 'admin' } }],
  ])('não vaza `lei-artigo` nem para %s', async (_label, auth) => {
    mockVerifyAuth.mockResolvedValue(auth);
    await GET(req(), ctx);
    expect(whereArg()).toMatchObject({ category: { notIn: ['lei-artigo'] } });
  });
});

/**
 * O vínculo documento↔artigo vem de um LLM instruído a incluir artigos
 * relacionados ao tema mesmo sem menção, com corte de confiança 40. O art. 5º
 * juntou 1.132 documentos dos quais só 39% o citam. `leiArticlesCited` guarda a
 * evidência determinística (regex sobre o texto) e permite separar os dois.
 */
describe('article-docs — separa citação de tema', () => {
  const doc = (id: string, cited: string[]) => ({
    id,
    title: `Doc ${id}`,
    category: 'acordao',
    isPublic: true,
    url: 'https://x',
    summary: null,
    description: null,
    notesImportance: null,
    leiArticlesArr: ['5'],
    leiArticlesCited: cited,
    leiArticlesDebated: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ valid: false });
    mockLegislativeActFindMany.mockResolvedValue([]);
    // 'cita' menciona o art. 5º; 'tema' está vinculado mas não o cita.
    mockDocumentFindMany.mockResolvedValue([doc('cita', ['5']), doc('tema', [])]);
  });

  const body = async () => (await GET(req(), ctx)).json();

  it('conta em `total` apenas quem cita', async () => {
    const b = await body();
    expect(b.total).toBe(1);
    expect(b.totalCited).toBe(1);
    expect(b.totalRelated).toBe(1);
  });

  it('só quem cita entra nos accordions por categoria', async () => {
    const b = await body();
    const ids = (Object.values(b.byCategory).flat() as Array<{ id: string }>).map((d) => d.id);
    expect(ids).toEqual(['cita']);
  });

  it('quem não cita vai para relatedByTheme — e não some', async () => {
    const b = await body();
    expect(b.relatedByTheme.map((d: { id: string }) => d.id)).toEqual(['tema']);
  });

  it('destaque nunca traz documento que não cita', async () => {
    const b = await body();
    expect(b.highlights.every((d: { citesArticle: boolean }) => d.citesArticle)).toBe(true);
  });

  it('ato normativo conta como citação (relação curada, não inferida)', async () => {
    mockDocumentFindMany.mockResolvedValue([]);
    mockLegislativeActFindMany.mockResolvedValue([
      {
        id: 'ato', fullNumber: 'Decreto 1', title: 'Decreto 1', ementa: null, summary: null,
        type: 'decreto', hierarchyLevel: 1, esfera: 'federal', issuer: 'x',
        officialUrl: 'https://x', leiArticlesArr: ['5'], importance: null,
      },
    ]);
    const b = await body();
    expect(b.totalRelated).toBe(0);
    expect(b.totalCited).toBe(1);
  });
});

/**
 * "Debatido no voto" (razão de decidir) é o tier mais forte da jurisprudência —
 * o artigo foi APLICADO no voto do acórdão, não só mencionado. Vem de
 * `Document.leiArticlesDebated` (lib/tcu/analise-relevancia.ts, v5), que NÃO é
 * subconjunto de `leiArticlesArr`: a IA sub-vincula regra concreta e a citação
 * no voto é prova própria. Por isso a rota tem de buscar por leiArticlesDebated
 * também, senão 64% desses acórdãos não chegam à página.
 */
describe('article-docs — debatido no voto (razão de decidir)', () => {
  const acordao = (
    id: string,
    o: { arr?: string[]; cited?: string[]; debated?: string[] },
  ) => ({
    id, title: `Acórdão ${id}`, category: 'acordao', isPublic: true, url: 'https://x',
    summary: null, description: null, notesImportance: null,
    leiArticlesArr: o.arr ?? [], leiArticlesCited: o.cited ?? [], leiArticlesDebated: o.debated ?? [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ valid: false });
    mockLegislativeActFindMany.mockResolvedValue([]);
  });
  const body = async () => (await GET(req(), ctx)).json();

  it('a busca inclui documentos por leiArticlesDebated (não só leiArticlesArr)', async () => {
    mockDocumentFindMany.mockResolvedValue([]);
    await GET(req(), ctx);
    expect(JSON.stringify(whereArg())).toContain('leiArticlesDebated');
  });

  it('acórdão debatido no voto SEM vínculo da IA aparece no tier (o caso dos 64%)', async () => {
    mockDocumentFindMany.mockResolvedValue([acordao('deb', { arr: [], debated: ['5'] })]);
    const b = await body();
    expect(b.debatedInVoto.map((d: { id: string }) => d.id)).toEqual(['deb']);
    expect(b.debatedInVoto[0].debatedInVoto).toBe(true);
    expect(b.totalDebated).toBe(1);
  });

  it('acórdão debatido NÃO é duplicado nos accordions por categoria', async () => {
    mockDocumentFindMany.mockResolvedValue([acordao('deb', { arr: ['5'], cited: ['5'], debated: ['5'] })]);
    const b = await body();
    const catIds = (Object.values(b.byCategory).flat() as Array<{ id: string }>).map((d) => d.id);
    expect(catIds).not.toContain('deb');
    expect(b.debatedInVoto.map((d: { id: string }) => d.id)).toEqual(['deb']);
  });

  it('acórdão citado mas NÃO debatido fica no accordion, fora do tier', async () => {
    mockDocumentFindMany.mockResolvedValue([acordao('cit', { arr: ['5'], cited: ['5'], debated: [] })]);
    const b = await body();
    expect(b.debatedInVoto).toEqual([]);
    const catIds = (Object.values(b.byCategory).flat() as Array<{ id: string }>).map((d) => d.id);
    expect(catIds).toContain('cit');
  });

  it('debatido não polui os destaques (regulamentação)', async () => {
    mockDocumentFindMany.mockResolvedValue([acordao('deb', { arr: ['5'], cited: ['5'], debated: ['5'] })]);
    const b = await body();
    expect(b.highlights.map((d: { id: string }) => d.id)).not.toContain('deb');
  });
});
