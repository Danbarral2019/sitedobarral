// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  hasAccessToDocument: vi.fn(),
  documentFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  accessLogCreate: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  verifyToken: mocks.verifyToken,
  hasAccessToDocument: mocks.hasAccessToDocument,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findUnique: mocks.documentFindUnique },
    user: { findUnique: mocks.userFindUnique },
    accessLog: { create: mocks.accessLogCreate },
  },
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/monitoring/events', () => ({ trackServerEvent: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

import { GET } from '../route';

function makeRequest(): NextRequest {
  const request = new NextRequest('http://localhost/api/documents/doc-common/download');
  request.cookies.set('auth-token', 'student-token');
  return request;
}

const context = { params: Promise.resolve({ id: 'doc-common' }) };

describe('GET /api/documents/[id]/download - acesso centralizado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockResolvedValue({ userId: 'user-1', role: 'student' });
    mocks.hasAccessToDocument.mockResolvedValue(true);
    mocks.documentFindUnique.mockResolvedValue({
      id: 'doc-common',
      title: 'Documento comum',
      url: 'https://example.com/doc.pdf',
      isPublic: false,
      isCommon: true,
      courseId: 'course-origin',
      metaDou: null,
    });
    mocks.userFindUnique.mockResolvedValue({
      id: 'user-1',
      role: 'student',
      enrollments: [],
    });
    mocks.accessLogCreate.mockResolvedValue({ id: 'log-1' });
  });

  it('permite documento comum a usuário com qualquer acesso ativo', async () => {
    const response = await GET(makeRequest(), context);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/doc.pdf');
    expect(mocks.hasAccessToDocument).toHaveBeenCalledWith({
      isPublic: false,
      isCommon: true,
      courseId: 'course-origin',
    });
  });
});
