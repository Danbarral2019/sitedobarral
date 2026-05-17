// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { stagingMock, documentMock, legislativeActMock } = vi.hoisted(() => ({
  stagingMock: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  documentMock: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  legislativeActMock: { create: vi.fn(), findUnique: vi.fn() },
}));

vi.mock('@/lib/api/handler', async () => {
  const { handleApiError } = await import('@/lib/errors/error-handler');
  return {
    withAdminApi:
      <P>(h: (req: NextRequest, ctx: { user: unknown; params: P; requestId: string; logger: unknown }) => Promise<Response>) =>
      async (req: NextRequest, ctx: { params: Promise<P> }) => {
        try {
          const params = await ctx.params;
          const mockCtx = {
            user: { userId: 'admin', email: 'admin@test', role: 'admin' as const },
            params,
            requestId: 'test',
            logger: console,
          };
          return await h(req, mockCtx);
        } catch (err) {
          return handleApiError(err);
        }
      },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dOUStagingDocument: stagingMock,
    document: documentMock,
    legislativeAct: legislativeActMock,
    $transaction: vi.fn(async (fn) =>
      fn({ document: documentMock, legislativeAct: legislativeActMock, dOUStagingDocument: stagingMock }),
    ),
  },
}));

vi.mock('@/lib/dou-scraper', () => ({ scrapeContent: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/lei-indexer', () => ({ LeiIndexer: { analyzeDocument: vi.fn().mockResolvedValue({ articles: [] }) } }));
vi.mock('@/lib/legislative-scrapers/scrape-and-index', () => ({ scrapeAndIndexAct: vi.fn().mockResolvedValue({ scraped: false, indexed: false }) }));

const { POST } = await import('../[id]/approve/route');

const fakeStaging = {
  id: 'staging-1',
  title: 'Portaria SEGES nº 8/2026',
  abstract: 'Atualiza pesquisa de preços',
  url: 'https://www.in.gov.br/web/dou/-/portaria-seges-8',
  publishDate: '03/05/2026',
  section: 'do1',
  hierarchyStr: 'MGI/SEGES',
  editorialScore: 85,
  editorialActType: 'portaria',
  editorialAffects: '["Lei 14.133"]',
  finalDecision: null,
  imported: false,
  documentId: null,
};

describe('POST /api/admin/clipping-dou/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentMock.create.mockResolvedValue({ id: 'doc-1' });
    documentMock.findFirst.mockResolvedValue({ id: 'doc-1' });
    legislativeActMock.findUnique.mockResolvedValue(null);
    legislativeActMock.create.mockResolvedValue({ id: 'act-1' });
    stagingMock.update.mockResolvedValue({});
  });

  it('cria Document, marca staging approved, retorna 200', async () => {
    stagingMock.findUnique.mockResolvedValue(fakeStaging);
    const req = new NextRequest('http://x/y', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'staging-1' }) });
    expect(res.status).toBe(200);
    expect(documentMock.create).toHaveBeenCalled();
    expect(stagingMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'staging-1' },
        data: expect.objectContaining({
          finalDecision: 'approved',
          imported: true,
          documentId: 'doc-1',
          reviewedBy: 'admin@test',
        }),
      }),
    );
  });

  it('retorna 404 quando staging não existe', async () => {
    stagingMock.findUnique.mockResolvedValue(null);
    const req = new NextRequest('http://x/y', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'inexistente' }) });
    expect(res.status).toBe(404);
  });

  it('retorna 409 quando staging já aprovado', async () => {
    stagingMock.findUnique.mockResolvedValue({ ...fakeStaging, finalDecision: 'approved' });
    const req = new NextRequest('http://x/y', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'staging-1' }) });
    expect(res.status).toBe(409);
  });
});
