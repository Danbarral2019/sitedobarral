// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Matrícula de assinatura tem expiresAt nulo (a Stripe controla o fim). Os
 * crons de email precisam incluí-la, como hasCourseAccess (lib/auth.ts) faz.
 */

const { mockEnrollmentFindMany, mockDocumentGroupBy, mockDocumentFindMany, mockLessonProgressGroupBy } =
  vi.hoisted(() => ({
    mockEnrollmentFindMany: vi.fn(),
    mockDocumentGroupBy: vi.fn(),
    mockDocumentFindMany: vi.fn(),
    mockLessonProgressGroupBy: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    enrollment: { findMany: (...args: unknown[]) => mockEnrollmentFindMany(...args) },
    document: {
      groupBy: (...args: unknown[]) => mockDocumentGroupBy(...args),
      findMany: (...args: unknown[]) => mockDocumentFindMany(...args),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    lessonProgress: { groupBy: (...args: unknown[]) => mockLessonProgressGroupBy(...args) },
    user: { update: vi.fn() },
  },
}));

vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => null }));
vi.mock('@/lib/cron-telemetry', () => ({
  withCronTelemetry: async (_name: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/email', () => ({
  sendNewDocumentsNotification: vi.fn().mockResolvedValue(true),
  sendInactivityReminderEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/push-notifications', () => ({ sendPushToUser: vi.fn() }));

function request(path: string) {
  return new Request(`https://exemplo.test${path}`) as unknown as import('next/server').NextRequest;
}

function criterioDaPrimeiraBusca() {
  expect(mockEnrollmentFindMany).toHaveBeenCalled();
  return mockEnrollmentFindMany.mock.calls[0][0].where.OR as unknown[];
}

describe('crons de email alcançam assinantes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockEnrollmentFindMany.mockResolvedValue([]);
    mockLessonProgressGroupBy.mockResolvedValue([]);
  });

  it('notify-new-documents inclui matrícula sem prazo (assinatura)', async () => {
    mockDocumentGroupBy.mockResolvedValue([{ courseId: '2', _count: 1 }]);
    mockDocumentFindMany.mockResolvedValue([
      { id: 'doc-1', title: 'Documento', description: null, category: 'apostila', uploadedAt: new Date() },
    ]);
    const { GET } = await import('../notify-new-documents/route');

    await GET(request('/api/cron/notify-new-documents'));

    expect(criterioDaPrimeiraBusca()).toContainEqual({ expiresAt: null });
  });

  it('lms-inactivity inclui matrícula sem prazo (assinatura)', async () => {
    const { GET } = await import('../lms-inactivity/route');

    await GET(request('/api/cron/lms-inactivity'));

    expect(criterioDaPrimeiraBusca()).toContainEqual({ expiresAt: null });
  });
});
