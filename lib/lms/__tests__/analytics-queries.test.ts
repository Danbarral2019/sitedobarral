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

  it('calcula stats de um quiz com N attempts mistos', async () => {
    mockFindMany.mockResolvedValue([
      { quizId: 'q1', score: 80, passed: true, userId: 'u1' },
      { quizId: 'q1', score: 40, passed: false, userId: 'u2' },
      { quizId: 'q1', score: 90, passed: true, userId: 'u1' },
      { quizId: 'q1', score: 60, passed: false, userId: 'u3' },
    ]);

    const result = await getQuizStatsBatch(['q1']);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { quizId: { in: ['q1'] } },
      select: { quizId: true, score: true, passed: true, userId: true },
    });
    expect(result.get('q1')).toEqual({
      quizId: 'q1',
      totalAttempts: 4,
      passedAttempts: 2,
      passRate: 50,
      avgScore: 68,
      uniqueUsers: 3,
    });
  });
});
