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
} = vi.hoisted(() => ({
  mockIndexJobFindMany: vi.fn(),
  mockDocumentFindMany: vi.fn(),
  mockTribunalDecisionFindMany: vi.fn(),
  mockIndexJobUpdate: vi.fn(),
  mockProcessDocument: vi.fn(),
  mockProcessTribunalDecision: vi.fn(),
  mockGetProcessingStats: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    indexJob: {
      findMany: (...args: any[]) => mockIndexJobFindMany(...args),
      update: (...args: any[]) => mockIndexJobUpdate(...args),
    },
    document: { findMany: (...args: any[]) => mockDocumentFindMany(...args) },
    tribunalDecision: { findMany: (...args: any[]) => mockTribunalDecisionFindMany(...args) },
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

import { GET } from '@/app/api/cron/process-index-jobs/route';

function makeReq(): Request {
  return new Request('http://localhost/api/cron/process-index-jobs', {
    method: 'GET',
    headers: { Authorization: 'Bearer test-secret' },
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

  // Defaults
  mockIndexJobFindMany.mockResolvedValue([]);
  mockDocumentFindMany.mockResolvedValue([]);
  mockTribunalDecisionFindMany.mockResolvedValue([]);
  mockGetProcessingStats.mockResolvedValue({ completed: 0, pending: 0, failed: 0 });
  mockProcessDocument.mockResolvedValue({ success: true, stats: { chunkCount: 3 } });
  mockProcessTribunalDecision.mockResolvedValue({ success: true, stats: { chunkCount: 2 } });
});

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
