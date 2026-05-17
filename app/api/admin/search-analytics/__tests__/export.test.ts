// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSearchHistoryFindMany,
  mockUserFindMany,
} = vi.hoisted(() => ({
  mockSearchHistoryFindMany: vi.fn(),
  mockUserFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    searchHistory: {
      findMany: (...args: any[]) => mockSearchHistoryFindMany(...args),
    },
    user: {
      findMany: (...args: any[]) => mockUserFindMany(...args),
    },
  },
}));

vi.mock('@/lib/api/handler', () => ({
  withAdminApi: (handler: any) => handler,
}));

import { GET } from '@/app/api/admin/search-analytics/export/route';

function makeReq(qs = ''): any {
  return new Request(
    `http://localhost/api/admin/search-analytics/export${qs}`,
    { method: 'GET' },
  );
}

beforeEach(() => {
  mockSearchHistoryFindMany.mockReset();
  mockUserFindMany.mockReset();
  mockSearchHistoryFindMany.mockResolvedValue([]);
  mockUserFindMany.mockResolvedValue([]);
});

describe('GET /api/admin/search-analytics/export', () => {
  it('retorna CSV vazio (apenas header) quando não há dados', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    const body = await res.text();
    expect(body).toBe(
      'id,createdAt,userEmail,type,query,filters,feedback,feedbackAt,feedbackNote,hasAiAnswer',
    );
  });

  it('serializa linha com email via lookup de user', async () => {
    mockSearchHistoryFindMany.mockResolvedValue([
      {
        id: 'sh-1',
        userId: 'u-1',
        type: 'documents',
        query: 'pregão eletrônico',
        filters: '{"courseId":"10"}',
        feedback: 1,
        feedbackNote: null,
        feedbackAt: new Date('2026-04-25T10:00:00Z'),
        aiAnswer: 'resposta...',
        createdAt: new Date('2026-04-25T09:55:00Z'),
      },
    ]);
    mockUserFindMany.mockResolvedValue([{ id: 'u-1', email: 'aluno@x.com' }]);

    const res = await GET(makeReq());
    const body = await res.text();
    const lines = body.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('sh-1');
    expect(lines[1]).toContain('aluno@x.com');
    expect(lines[1]).toContain('documents');
    expect(lines[1]).toContain('pregão eletrônico');
    expect(lines[1]).toContain('positive');
    expect(lines[1]).toContain('1'); // hasAiAnswer
  });

  it('escapa vírgulas, aspas e quebras de linha em CSV', async () => {
    mockSearchHistoryFindMany.mockResolvedValue([
      {
        id: 'sh-2',
        userId: 'u-1',
        type: 'jurisprudencia',
        query: 'lei 14.133, art. 75',
        filters: null,
        feedback: -1,
        feedbackNote: 'A resposta\ntinha "erro"',
        feedbackAt: null,
        aiAnswer: null,
        createdAt: new Date('2026-04-25T09:00:00Z'),
      },
    ]);
    mockUserFindMany.mockResolvedValue([{ id: 'u-1', email: 'a@b.com' }]);

    const res = await GET(makeReq());
    const body = await res.text();
    expect(body).toContain('"lei 14.133, art. 75"');
    expect(body).toContain('"A resposta tinha ""erro"""');
    expect(body).toContain('negative');
    expect(body).toContain('0'); // hasAiAnswer = 0 quando null
  });

  it('escapa formula injection (= + - @) com aspas', async () => {
    mockSearchHistoryFindMany.mockResolvedValue([
      {
        id: 'sh-3',
        userId: 'u-1',
        type: 'documents',
        query: '=cmd|"/c calc"!A1',
        filters: null,
        feedback: null,
        feedbackNote: null,
        feedbackAt: null,
        aiAnswer: null,
        createdAt: new Date('2026-04-25T09:00:00Z'),
      },
    ]);
    mockUserFindMany.mockResolvedValue([{ id: 'u-1', email: 'a@b.com' }]);

    const res = await GET(makeReq());
    const body = await res.text();
    expect(body).toMatch(/"=cmd\|""\/c calc""!A1"/);
  });

  it('aceita query param days e usa default 30 se inválido', async () => {
    mockSearchHistoryFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);

    await GET(makeReq('?days=7'));
    let call = mockSearchHistoryFindMany.mock.calls[0][0];
    let since: Date = call.where.createdAt.gte;
    let diffDays = (Date.now() - since.getTime()) / (24 * 3600 * 1000);
    expect(diffDays).toBeGreaterThan(6.99);
    expect(diffDays).toBeLessThan(7.01);

    mockSearchHistoryFindMany.mockClear();
    await GET(makeReq('?days=abc'));
    call = mockSearchHistoryFindMany.mock.calls[0][0];
    since = call.where.createdAt.gte;
    diffDays = (Date.now() - since.getTime()) / (24 * 3600 * 1000);
    expect(diffDays).toBeGreaterThan(29.99);
    expect(diffDays).toBeLessThan(30.01);

    mockSearchHistoryFindMany.mockClear();
    await GET(makeReq('?days=999')); // > 365 → default 30
    call = mockSearchHistoryFindMany.mock.calls[0][0];
    since = call.where.createdAt.gte;
    diffDays = (Date.now() - since.getTime()) / (24 * 3600 * 1000);
    expect(diffDays).toBeGreaterThan(29.99);
    expect(diffDays).toBeLessThan(30.01);
  });

  it('inclui filename com data e dias no Content-Disposition', async () => {
    const res = await GET(makeReq('?days=7'));
    const cd = res.headers.get('Content-Disposition');
    expect(cd).toMatch(/search-analytics-\d{4}-\d{2}-\d{2}-7d\.csv/);
  });
});
