// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  hasAccessToCourse: vi.fn(),
  userFindUnique: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  moduleFindMany: vi.fn(),
  lessonProgressFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyToken: mocks.verifyToken,
  hasAccessToCourse: mocks.hasAccessToCourse,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    enrollment: { findFirst: mocks.enrollmentFindFirst },
    module: { findMany: mocks.moduleFindMany },
    lessonProgress: { findMany: mocks.lessonProgressFindMany },
  },
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

import { GET } from '../route';

function makeRequest(): NextRequest {
  const request = new NextRequest('http://localhost/api/area-restrita/courses/course-1/progress');
  request.cookies.set('auth-token', 'student-token');
  return request;
}

const context = { params: Promise.resolve({ courseId: 'course-1' }) };

describe('GET /api/area-restrita/courses/[courseId]/progress - acesso ao curso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockResolvedValue({ userId: 'user-1', role: 'student' });
    mocks.userFindUnique.mockResolvedValue({ id: 'user-1', role: 'student' });
    mocks.moduleFindMany.mockResolvedValue([]);
    mocks.lessonProgressFindMany.mockResolvedValue([]);
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
