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

import { getQuizStatsBatch, getAttemptScoresByUser, getEnrolledUserQuizPassRates, getPassedQuizIds } from '@/lib/lms/analytics-queries';

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

  it('separa stats por quizId em batch multi-quiz', async () => {
    mockFindMany.mockResolvedValue([
      { quizId: 'q1', score: 100, passed: true, userId: 'u1' },
      { quizId: 'q2', score: 30, passed: false, userId: 'u1' },
      { quizId: 'q2', score: 70, passed: true, userId: 'u2' },
    ]);

    const result = await getQuizStatsBatch(['q1', 'q2', 'q3']);

    expect(result.size).toBe(3);
    expect(result.get('q1')).toMatchObject({ totalAttempts: 1, passedAttempts: 1, passRate: 100, avgScore: 100, uniqueUsers: 1 });
    expect(result.get('q2')).toMatchObject({ totalAttempts: 2, passedAttempts: 1, passRate: 50, avgScore: 50, uniqueUsers: 2 });
    expect(result.get('q3')).toMatchObject({ totalAttempts: 0, passedAttempts: 0, passRate: 0, avgScore: 0, uniqueUsers: 0 });
  });

  it('chama prisma.quizAttempt.findMany EXATAMENTE uma vez para N quizIds', async () => {
    mockFindMany.mockResolvedValue([]);

    await getQuizStatsBatch(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });
});

describe('getAttemptScoresByUser', () => {
  beforeEach(() => mockFindMany.mockReset());

  it('retorna Map vazio quando quizIds ou userIds vazios', async () => {
    expect((await getAttemptScoresByUser([], ['u1'])).size).toBe(0);
    expect((await getAttemptScoresByUser(['q1'], [])).size).toBe(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('agrupa scores por userId em uma única query', async () => {
    mockFindMany.mockResolvedValue([
      { userId: 'u1', score: 80 },
      { userId: 'u1', score: 90 },
      { userId: 'u2', score: 50 },
    ]);

    const result = await getAttemptScoresByUser(['q1', 'q2'], ['u1', 'u2']);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { quizId: { in: ['q1', 'q2'] }, userId: { in: ['u1', 'u2'] } },
      select: { userId: true, score: true },
    });
    expect(result.get('u1')).toEqual([80, 90]);
    expect(result.get('u2')).toEqual([50]);
  });
});

describe('getEnrolledUserQuizPassRates', () => {
  beforeEach(() => mockFindMany.mockReset());

  it('retorna 0 sem chamar prisma quando quizIds = []', async () => {
    expect(await getEnrolledUserQuizPassRates('u1', [])).toBe(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('conta quizzes distintos que o user passou', async () => {
    mockFindMany.mockResolvedValue([
      { quizId: 'q1' },
      { quizId: 'q3' },
    ]);

    const count = await getEnrolledUserQuizPassRates('u1', ['q1', 'q2', 'q3']);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: 'u1', quizId: { in: ['q1', 'q2', 'q3'] }, passed: true },
      distinct: ['quizId'],
      select: { quizId: true },
    });
    expect(count).toBe(2);
  });
});

describe('getPassedQuizIds', () => {
  beforeEach(() => mockFindMany.mockReset());

  it('retorna Set vazio sem chamar prisma quando quizIds = []', async () => {
    const result = await getPassedQuizIds('u1', []);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('retorna Set dos quizIds passados em uma única query', async () => {
    mockFindMany.mockResolvedValue([{ quizId: 'q1' }, { quizId: 'q3' }]);
    const result = await getPassedQuizIds('u1', ['q1', 'q2', 'q3']);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: 'u1', quizId: { in: ['q1', 'q2', 'q3'] }, passed: true },
      distinct: ['quizId'],
      select: { quizId: true },
    });
    expect(result.has('q1')).toBe(true);
    expect(result.has('q2')).toBe(false);
    expect(result.has('q3')).toBe(true);
    expect(result.size).toBe(2);
  });
});
