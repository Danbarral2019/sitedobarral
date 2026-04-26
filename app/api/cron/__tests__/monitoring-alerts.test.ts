// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAccessLogCount,
  mockScraperFindMany,
  mockSearchHistoryGroupBy,
  mockVerifyCronAuth,
  mockResendSend,
} = vi.hoisted(() => ({
  mockAccessLogCount: vi.fn(),
  mockScraperFindMany: vi.fn(),
  mockSearchHistoryGroupBy: vi.fn(),
  mockVerifyCronAuth: vi.fn(),
  mockResendSend: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    accessLog: { count: (...args: any[]) => mockAccessLogCount(...args) },
    scraperHealthLog: {
      findMany: (...args: any[]) => mockScraperFindMany(...args),
    },
    searchHistory: {
      groupBy: (...args: any[]) => mockSearchHistoryGroupBy(...args),
    },
  },
}));

vi.mock('@/lib/cron-auth', () => ({
  verifyCronAuth: (...args: any[]) => mockVerifyCronAuth(...args),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...args: any[]) => mockResendSend(...args) };
  },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from '@/app/api/cron/monitoring-alerts/route';

function makeReq(): any {
  return new Request('http://localhost/api/cron/monitoring-alerts', {
    method: 'GET',
  });
}

beforeEach(() => {
  mockAccessLogCount.mockReset();
  mockScraperFindMany.mockReset();
  mockSearchHistoryGroupBy.mockReset();
  mockVerifyCronAuth.mockReset();
  mockResendSend.mockReset();

  mockVerifyCronAuth.mockReturnValue(null);
  mockAccessLogCount.mockResolvedValue(99);
  mockScraperFindMany.mockResolvedValue([]);
  mockSearchHistoryGroupBy.mockResolvedValue([]);
  mockResendSend.mockResolvedValue({ id: 'mail-1' });
  process.env.ADMIN_ALERT_EMAIL = 'admin@test.com';
});

describe('GET /api/cron/monitoring-alerts — feedback ratio', () => {
  it('NÃO alerta quando volume de votos < 10', async () => {
    mockSearchHistoryGroupBy.mockResolvedValue([
      { feedback: -1, _count: { _all: 5 } },
      { feedback: 1, _count: { _all: 2 } },
    ]);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.alerts).toEqual([]);
    expect(json.alertCount).toBe(0);
  });

  it('NÃO alerta quando ratio 👎 < 30% (mesmo com volume alto)', async () => {
    mockSearchHistoryGroupBy.mockResolvedValue([
      { feedback: -1, _count: { _all: 5 } },
      { feedback: 1, _count: { _all: 30 } },
    ]);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.alerts).toEqual([]);
  });

  it('alerta quando ratio 👎 ≥ 30% E volume ≥ 10', async () => {
    mockSearchHistoryGroupBy.mockResolvedValue([
      { feedback: -1, _count: { _all: 6 } },
      { feedback: 1, _count: { _all: 10 } },
    ]);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.alertCount).toBe(1);
    expect(json.alerts[0]).toMatch(/Feedback negativo na busca: 6/);
    expect(json.alerts[0]).toMatch(/10/);
    expect(json.alerts[0]).toMatch(/38%/);
    expect(mockResendSend).toHaveBeenCalledOnce();
  });

  it('alerta com 100% 👎 quando volume ≥ 10 e zero 👍', async () => {
    mockSearchHistoryGroupBy.mockResolvedValue([
      { feedback: -1, _count: { _all: 12 } },
    ]);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.alertCount).toBe(1);
    expect(json.alerts[0]).toMatch(/100%/);
  });

  it('NÃO alerta quando exatamente 9 votos (abaixo do mínimo)', async () => {
    mockSearchHistoryGroupBy.mockResolvedValue([
      { feedback: -1, _count: { _all: 9 } },
    ]);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.alertCount).toBe(0);
  });

  it('alerta nos exatos 30% com volume 10', async () => {
    mockSearchHistoryGroupBy.mockResolvedValue([
      { feedback: -1, _count: { _all: 3 } },
      { feedback: 1, _count: { _all: 7 } },
    ]);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.alertCount).toBe(1);
    expect(json.alerts[0]).toMatch(/30%/);
  });
});
