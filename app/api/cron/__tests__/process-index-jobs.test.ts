// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockIndexJobFindMany,
  mockDocumentFindMany,
  mockTribunalDecisionFindMany,
  mockIndexJobUpdate,
  mockProcessDocument,
  mockProcessTribunalDecision,
  mockGetProcessingStats,
  mockGlossaryFindUnique,
  mockBlogPostFindUnique,
  mockLeiArticleFindUnique,
} = vi.hoisted(() => ({
  mockIndexJobFindMany: vi.fn(),
  mockDocumentFindMany: vi.fn(),
  mockTribunalDecisionFindMany: vi.fn(),
  mockIndexJobUpdate: vi.fn(),
  mockProcessDocument: vi.fn(),
  mockProcessTribunalDecision: vi.fn(),
  mockGetProcessingStats: vi.fn(),
  mockGlossaryFindUnique: vi.fn(),
  mockBlogPostFindUnique: vi.fn(),
  mockLeiArticleFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    indexJob: {
      findMany: (...args: any[]) => mockIndexJobFindMany(...args),
      update: (...args: any[]) => mockIndexJobUpdate(...args),
    },
    document: { findMany: (...args: any[]) => mockDocumentFindMany(...args) },
    tribunalDecision: { findMany: (...args: any[]) => mockTribunalDecisionFindMany(...args) },
    glossaryTerm: { findUnique: (...args: any[]) => mockGlossaryFindUnique(...args) },
    blogPost: { findUnique: (...args: any[]) => mockBlogPostFindUnique(...args) },
    leiArticle: { findUnique: (...args: any[]) => mockLeiArticleFindUnique(...args) },
  },
}));

vi.mock('@/lib/embeddings/document-processor', () => ({
  processDocument: (...args: any[]) => mockProcessDocument(...args),
  getProcessingStats: (...args: any[]) => mockGetProcessingStats(...args),
}));

vi.mock('@/lib/embeddings/tribunal-decision-processor', () => ({
  processTribunalDecision: (...args: any[]) => mockProcessTribunalDecision(...args),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Precisa ser setado antes do import porque a rota lê process.env.CRON_SECRET
// no topo do módulo; `vi.hoisted` garante execução antes dos imports.
vi.hoisted(() => {
  process.env.CRON_SECRET = 'test-secret';
});

import { GET, POST } from '@/app/api/cron/process-index-jobs/route';

function makeReq(): Request {
  return new Request('http://localhost/api/cron/process-index-jobs', {
    method: 'GET',
    headers: { Authorization: 'Bearer test-secret' },
  });
}

function makePost(body: unknown, auth = 'Bearer test-secret'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = auth;
  return new Request('http://localhost/api/cron/process-index-jobs', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockIndexJobFindMany.mockReset();
  mockDocumentFindMany.mockReset();
  mockTribunalDecisionFindMany.mockReset();
  mockIndexJobUpdate.mockReset();
  mockProcessDocument.mockReset();
  mockProcessTribunalDecision.mockReset();
  mockGetProcessingStats.mockReset();
  mockGlossaryFindUnique.mockReset();
  mockBlogPostFindUnique.mockReset();
  mockLeiArticleFindUnique.mockReset();

  // Defaults
  mockIndexJobFindMany.mockResolvedValue([]);
  mockDocumentFindMany.mockResolvedValue([]);
  mockTribunalDecisionFindMany.mockResolvedValue([]);
  mockGetProcessingStats.mockResolvedValue({ completed: 0, pending: 0, failed: 0 });
  mockProcessDocument.mockResolvedValue({ success: true, stats: { chunkCount: 3 } });
  mockProcessTribunalDecision.mockResolvedValue({ success: true, stats: { chunkCount: 2 } });
  mockIndexJobUpdate.mockResolvedValue({});
  mockGlossaryFindUnique.mockResolvedValue({ id: 'g1', term: 'Licitação', definition: 'def', category: 'geral' });
  mockBlogPostFindUnique.mockResolvedValue({ id: 'b1', title: 'Post' });
  mockLeiArticleFindUnique.mockResolvedValue({ id: 'l1', numero: '75' });
});

// Helper: monta um IndexJob pendente
function job(entityType: string, over: Record<string, unknown> = {}) {
  return { id: `job-${entityType}`, entityType, entityId: `ent-${entityType}`, attempts: 0, ...over };
}

describe('GET /api/cron/process-index-jobs — MAX_JOBS_PER_RUN = 50', () => {
  it('document findMany chamado com take=50', async () => {
    await GET(makeReq() as any);
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });
});

describe('GET /api/cron/process-index-jobs — ordenação FIFO', () => {
  it('document findMany usa uploadedAt ASC', async () => {
    await GET(makeReq() as any);
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { uploadedAt: 'asc' } })
    );
  });

  it('tribunalDecision findMany usa createdAt ASC', async () => {
    await GET(makeReq() as any);
    expect(mockTribunalDecisionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } })
    );
  });
});

describe('GET /api/cron/process-index-jobs — batches paralelos', () => {
  it('processa documents em batches de 10 via Promise.all', async () => {
    // 25 documents pending → 3 batches (10, 10, 5)
    mockDocumentFindMany.mockResolvedValueOnce(
      Array.from({ length: 25 }, (_, i) => ({ id: `doc-${i}` }))
    );

    let concurrent = 0;
    let maxConcurrent = 0;
    mockProcessDocument.mockImplementation(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(resolve => setTimeout(resolve, 10));
      concurrent--;
      return { success: true, stats: { chunkCount: 3 } };
    });

    await GET(makeReq() as any);

    expect(mockProcessDocument).toHaveBeenCalledTimes(25);
    expect(maxConcurrent).toBeGreaterThanOrEqual(5);
    expect(maxConcurrent).toBeLessThanOrEqual(10);
  });
});

describe('GET /api/cron/process-index-jobs — autorização', () => {
  it('retorna 401 sem auth', async () => {
    const req = new Request('http://localhost/api/cron/process-index-jobs', {
      method: 'GET',
    });
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('retorna 401 com auth errada', async () => {
    const req = new Request('http://localhost/api/cron/process-index-jobs', {
      method: 'GET',
      headers: { Authorization: 'Bearer wrong' },
    });
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/cron/process-index-jobs — response shape', () => {
  it('retorna summary com processed, completed, failed', async () => {
    mockDocumentFindMany.mockResolvedValueOnce([
      { id: 'doc-1' }, { id: 'doc-2' },
    ]);

    const res = await GET(makeReq() as any);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(2);
    expect(body.completed).toBe(2);
    expect(body.failed).toBe(0);
  });
});

describe('GET — despacho de IndexJobs por entityType', () => {
  it('processa jobs de document/glossary/blog-post/lei-article e marca completed', async () => {
    mockIndexJobFindMany.mockResolvedValueOnce([
      job('document'), job('glossary'), job('blog-post'), job('lei-article'),
    ]);
    const res = await GET(makeReq() as any);
    const body = await res.json();
    expect(body.processed).toBe(4);
    expect(body.completed).toBe(4);
    // cada job: 1 update p/ 'processing' + 1 update p/ 'completed'
    expect(mockIndexJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'processing' }) }),
    );
    expect(mockGlossaryFindUnique).toHaveBeenCalled();
    expect(mockBlogPostFindUnique).toHaveBeenCalled();
    expect(mockLeiArticleFindUnique).toHaveBeenCalled();
  });

  it('entityType desconhecido → job falha', async () => {
    mockIndexJobFindMany.mockResolvedValueOnce([job('xpto')]);
    const res = await GET(makeReq() as any);
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.results[0].error).toContain('Unknown entity type');
  });

  it('glossary/blog/lei ausentes → job falha (not found)', async () => {
    mockIndexJobFindMany.mockResolvedValueOnce([job('glossary')]);
    mockGlossaryFindUnique.mockResolvedValueOnce(null);
    const res = await GET(makeReq() as any);
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.results[0].error).toContain('not found');
  });

  it('document job que retorna success:false → failed com retry (status volta a pending)', async () => {
    mockIndexJobFindMany.mockResolvedValueOnce([job('document', { attempts: 0 })]);
    mockProcessDocument.mockResolvedValueOnce({ success: false, error: 'boom' });
    const res = await GET(makeReq() as any);
    const body = await res.json();
    expect(body.failed).toBe(1);
    // último update do job deve reagendar (pending) por ainda ter tentativas
    expect(mockIndexJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pending', lastError: 'boom' }) }),
    );
  });

  it('document job falha na última tentativa → status failed', async () => {
    // attempts=2 e MAX_RETRY=3 → attempts+1=3 → não reagenda
    mockIndexJobFindMany.mockResolvedValueOnce([job('document', { attempts: 2 })]);
    mockProcessDocument.mockResolvedValueOnce({ success: false, error: 'fatal' });
    const res = await GET(makeReq() as any);
    await res.json();
    expect(mockIndexJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('processDocumentJob captura exceção do processador', async () => {
    mockIndexJobFindMany.mockResolvedValueOnce([job('document')]);
    mockProcessDocument.mockRejectedValueOnce(new Error('crash'));
    const res = await GET(makeReq() as any);
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.results[0].error).toBe('crash');
  });
});

describe('GET — early return e caminhos de erro', () => {
  it('sem nada pendente → "No pending jobs"', async () => {
    const res = await GET(makeReq() as any);
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(body.message).toBe('No pending jobs');
  });

  it('documento direto que falha entra como failed no summary', async () => {
    mockDocumentFindMany.mockResolvedValueOnce([{ id: 'doc-x' }]);
    mockProcessDocument.mockRejectedValueOnce(new Error('proc fail'));
    const res = await GET(makeReq() as any);
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.results[0].error).toBe('proc fail');
  });

  it('tribunal decision que falha entra como failed no summary', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([{ id: 'td-1' }]);
    mockProcessTribunalDecision.mockRejectedValueOnce(new Error('td fail'));
    const res = await GET(makeReq() as any);
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.results[0].error).toBe('td fail');
  });

  it('retorna 500 quando o processamento lança', async () => {
    mockGetProcessingStats.mockRejectedValueOnce(new Error('stats down'));
    const res = await GET(makeReq() as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('POST — trigger manual', () => {
  it('401 sem auth', async () => {
    const res = await POST(makePost({ documentIds: ['d1'] }, '') as any);
    expect(res.status).toBe(401);
  });

  it('400 sem documentIds válido', async () => {
    const res = await POST(makePost({}) as any);
    expect(res.status).toBe(400);
    const res2 = await POST(makePost({ documentIds: [] }) as any);
    expect(res2.status).toBe(400);
  });

  it('processa os documentIds e retorna summary', async () => {
    const res = await POST(makePost({ documentIds: ['d1', 'd2'], forceReprocess: true }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(2);
    expect(body.completed).toBe(2);
    expect(mockProcessDocument).toHaveBeenCalledWith('d1', { forceReprocess: true });
  });

  it('marca documento como failed quando processDocument não tem sucesso', async () => {
    mockProcessDocument.mockResolvedValueOnce({ success: false, error: 'nope' });
    const res = await POST(makePost({ documentIds: ['d1'] }) as any);
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.results[0].error).toBe('nope');
  });

  it('retorna 500 quando o corpo é inválido', async () => {
    const badReq = new Request('http://localhost/api/cron/process-index-jobs', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' },
      body: 'não é json',
    });
    const res = await POST(badReq as any);
    expect(res.status).toBe(500);
  });
});

describe('GET — job processors: not-found e exceção', () => {
  it('blog-post ausente e exceção viram failed', async () => {
    mockIndexJobFindMany.mockResolvedValueOnce([job('blog-post', { id: 'j-nf' })]);
    mockBlogPostFindUnique.mockResolvedValueOnce(null);
    let res = await GET(makeReq() as any);
    expect((await res.json()).results[0].error).toContain('not found');

    mockIndexJobFindMany.mockResolvedValueOnce([job('blog-post', { id: 'j-ex' })]);
    mockBlogPostFindUnique.mockRejectedValueOnce(new Error('db down'));
    res = await GET(makeReq() as any);
    expect((await res.json()).results[0].error).toBe('db down');
  });

  it('lei-article ausente e exceção viram failed', async () => {
    mockIndexJobFindMany.mockResolvedValueOnce([job('lei-article', { id: 'j-nf' })]);
    mockLeiArticleFindUnique.mockResolvedValueOnce(null);
    let res = await GET(makeReq() as any);
    expect((await res.json()).results[0].error).toContain('not found');

    mockIndexJobFindMany.mockResolvedValueOnce([job('lei-article', { id: 'j-ex' })]);
    mockLeiArticleFindUnique.mockRejectedValueOnce(new Error('db down'));
    res = await GET(makeReq() as any);
    expect((await res.json()).results[0].error).toBe('db down');
  });

  it('glossary com exceção vira failed', async () => {
    mockIndexJobFindMany.mockResolvedValueOnce([job('glossary', { id: 'j-ex' })]);
    mockGlossaryFindUnique.mockRejectedValueOnce(new Error('db down'));
    const res = await GET(makeReq() as any);
    expect((await res.json()).results[0].error).toBe('db down');
  });

  it('tribunal decision processada com sucesso entra no summary', async () => {
    mockTribunalDecisionFindMany.mockResolvedValueOnce([{ id: 'td-ok' }]);
    const res = await GET(makeReq() as any);
    const body = await res.json();
    expect(body.completed).toBe(1);
    expect(body.results[0].jobId).toBe('tribunal-td-ok');
  });
});
