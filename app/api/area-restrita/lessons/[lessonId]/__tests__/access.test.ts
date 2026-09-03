// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  hasAccessToCourse: vi.fn(),
  userFindUnique: vi.fn(),
  lessonFindUnique: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  lessonProgressFindUnique: vi.fn(),
  courseStatusFindUnique: vi.fn(),
  moduleFindMany: vi.fn(),
  quizAttemptFindFirst: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyToken: mocks.verifyToken,
  hasAccessToCourse: mocks.hasAccessToCourse,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    lesson: { findUnique: mocks.lessonFindUnique },
    enrollment: { findFirst: mocks.enrollmentFindFirst },
    lessonProgress: { findUnique: mocks.lessonProgressFindUnique },
    courseStatus: { findUnique: mocks.courseStatusFindUnique },
    module: { findMany: mocks.moduleFindMany },
    quizAttempt: { findFirst: mocks.quizAttemptFindFirst },
  },
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

import { GET } from '../route';

function makeRequest(): NextRequest {
  const request = new NextRequest('http://localhost/api/area-restrita/lessons/lesson-1');
  request.cookies.set('auth-token', 'student-token');
  return request;
}

const context = { params: Promise.resolve({ lessonId: 'lesson-1' }) };

describe('GET /api/area-restrita/lessons/[lessonId] - acesso ao curso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockResolvedValue({ userId: 'user-1', role: 'student' });
    mocks.userFindUnique.mockResolvedValue({ id: 'user-1', role: 'student' });
    mocks.lessonFindUnique.mockResolvedValue({
      id: 'lesson-1',
      title: 'Aula 1',
      slug: 'aula-1',
      description: null,
      content: null,
      estimatedMinutes: 10,
      aiSummary: null,
      aiKeyPoints: null,
      leiArticlesArr: [],
      isPublished: true,
      prerequisiteId: null,
      module: { id: 'module-1', title: 'Módulo 1', courseId: 'course-1' },
      documents: [],
      videos: [],
    });
    mocks.lessonProgressFindUnique.mockResolvedValue(null);
    mocks.courseStatusFindUnique.mockResolvedValue(null);
    mocks.moduleFindMany.mockResolvedValue([]);
  });

  it('nega matrícula vencida mesmo quando ainda existe registro no banco', async () => {
    mocks.hasAccessToCourse.mockResolvedValue(false);
    mocks.enrollmentFindFirst.mockResolvedValue({
      id: 'expired-enrollment',
      expiresAt: new Date('2025-01-01T00:00:00.000Z'),
      isLifetime: false,
    });

    const response = await GET(makeRequest(), context);

    expect(response.status).toBe(403);
    expect(mocks.hasAccessToCourse).toHaveBeenCalledWith('course-1');
  });

  it('permite matrícula vitalícia validada pelo helper central', async () => {
    mocks.hasAccessToCourse.mockResolvedValue(true);
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await GET(makeRequest(), context);

    expect(response.status).toBe(200);
    expect(mocks.hasAccessToCourse).toHaveBeenCalledWith('course-1');
  });

  it('permite assinatura Premium ativa validada pelo helper central', async () => {
    mocks.hasAccessToCourse.mockResolvedValue(true);
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    const response = await GET(makeRequest(), context);

    expect(response.status).toBe(200);
    expect(mocks.hasAccessToCourse).toHaveBeenCalledWith('course-1');
  });
});
