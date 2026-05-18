// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (accessible inside vi.mock factories) ───────────────────

const { mockLoggerInfo, mockLoggerError, mockSentryBreadcrumb } = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
  mockSentryBreadcrumb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: mockSentryBreadcrumb,
}));

import { withTiming } from '@/lib/lms/query-timing';

describe('withTiming', () => {
  beforeEach(() => {
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();
    mockSentryBreadcrumb.mockClear();
  });

  it('registra info log com ms_total ao concluir com sucesso', async () => {
    const result = await withTiming('lms.test.fast', async () => 42);

    expect(result).toBe(42);
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    const [meta, msg] = mockLoggerInfo.mock.calls[0];
    expect(msg).toBe('lms.query');
    expect(meta.lms_query).toBe('lms.test.fast');
    expect(typeof meta.ms_total).toBe('number');
    expect(meta.ms_total).toBeGreaterThanOrEqual(0);
  });

  it('NÃO chama Sentry breadcrumb quando ms ≤ 500', async () => {
    await withTiming('lms.test.fast', async () => 'ok');
    expect(mockSentryBreadcrumb).not.toHaveBeenCalled();
  });
});
