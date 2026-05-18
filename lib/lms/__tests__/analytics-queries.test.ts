// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quizAttempt: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Tests ──────────────────────────────────────────────────────────────────

import { getQuizStatsBatch } from '@/lib/lms/analytics-queries';

describe('getQuizStatsBatch', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('retorna Map vazio sem chamar prisma quando quizIds é []', async () => {
    const result = await getQuizStatsBatch([]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
