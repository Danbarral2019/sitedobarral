import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/api-middleware', () => ({
  verifyAdmin: vi.fn(async () => ({ error: null })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    leiArticle: { findUnique: vi.fn() },
    document: { findMany: vi.fn() },
    legislativeAct: { findMany: vi.fn() },
  },
}));

const { prisma } = await import('@/lib/prisma');

describe('GET /api/admin/lei-14133/articles/[numero]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 404 quando artigo não existe', async () => {
    (prisma.leiArticle.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/admin/lei-14133/articles/999');
    const res = await GET(req, { params: Promise.resolve({ numero: '999' }) });
    expect(res.status).toBe(404);
  });

  it('retorna artigo enriquecido com docs e atos vinculados', async () => {
    (prisma.leiArticle.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a',
      numero: '18',
      titulo: 'TÍTULO I',
      capitulo: 'CAP I',
      capituloCompleto: 'CAPÍTULO I',
      ementa: 'Texto do art. 18',
      secao: null,
      professorComment: '# Comentário',
      commentUpdatedAt: new Date(),
      crossRefs: [{ id: 'c1', targetNumber: '44', note: 'foo', order: 0 }],
      suggestedReadings: [],
    });
    (prisma.document.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'd1', title: 'Doc A', leiArticles: '["18"]', category: 'parecer', isPublic: true, notesImportance: null },
    ]);
    (prisma.legislativeAct.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'l1', fullNumber: 'IN 67/2021', title: 'Dispensa eletrônica', ementa: 'foo', leiArticles: '["18","75"]', importance: 'alta', type: 'in', hierarchyLevel: 4, esfera: 'federal' },
    ]);
    const req = new NextRequest('http://localhost/api/admin/lei-14133/articles/18');
    const res = await GET(req, { params: Promise.resolve({ numero: '18' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.article.numero).toBe('18');
    expect(body.article.professorComment).toBe('# Comentário');
    expect(body.linkedDocuments).toHaveLength(1);
    expect(body.linkedActs).toHaveLength(1);
    expect(body.linkedActs[0].importance).toBe('alta');
  });
});
