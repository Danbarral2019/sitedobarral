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

  it('chama Sentry breadcrumb quando ms > 500', async () => {
    // Simulamos lentidão sem usar setTimeout real (deixaria o teste flaky)
    let n = 0;
    const originalNow = performance.now.bind(performance);
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => {
      n += 1;
      // 1ª chamada (start) retorna 0; 2ª (end) retorna 800ms
      return n === 1 ? 0 : 800;
    });

    await withTiming('lms.test.slow', async () => 'ok');

    expect(mockSentryBreadcrumb).toHaveBeenCalledTimes(1);
    expect(mockSentryBreadcrumb).toHaveBeenCalledWith({
      category: 'lms.slow',
      level: 'warning',
      message: 'lms.test.slow',
      data: { ms: 800 },
    });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ lms_query: 'lms.test.slow', ms_total: 800 }),
      'lms.query',
    );

    nowSpy.mockRestore();
    // restaurar referência caso outros testes mexam
    performance.now = originalNow;
  });

  it('loga erro e re-throws o erro original em falha', async () => {
    const original = new Error('boom');
    let caught: unknown;
    try {
      await withTiming('lms.test.fail', async () => {
        throw original;
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(original);
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ lms_query: 'lms.test.fail', err: original }),
      'lms.query.failed',
    );
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });
});
