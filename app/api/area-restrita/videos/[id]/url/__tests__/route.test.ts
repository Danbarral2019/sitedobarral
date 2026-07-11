// app/api/area-restrita/videos/[id]/url/__tests__/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCurrentUser, mockFindVideo, mockFindEnrollment, mockSign, mockRateLimit } =
  vi.hoisted(() => ({
    mockGetCurrentUser: vi.fn(),
    mockFindVideo: vi.fn(),
    mockFindEnrollment: vi.fn(),
    mockSign: vi.fn(),
    mockRateLimit: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({ getCurrentUser: (...a: any[]) => mockGetCurrentUser(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    courseVideo: { findUnique: (...a: any[]) => mockFindVideo(...a) },
    enrollment: { findFirst: (...a: any[]) => mockFindEnrollment(...a) },
  },
}));
vi.mock('@/lib/storage/r2-client', () => ({ getSignedR2Url: (...a: any[]) => mockSign(...a) }));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...a: any[]) => mockRateLimit(...a),
  getClientIp: () => '127.0.0.1',
}));
// withUserApi chama apiLogger.child(); o mock global de test/setup.ts NÃO tem .child.
// Sobrescrever localmente com .child (padrão de app/api/admin/legislative-relations/.../route.test.ts).
vi.mock('@/lib/logger', () => ({
  apiLogger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  authLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from '@/app/api/area-restrita/videos/[id]/url/route';

const call = (id: string) =>
  GET(new Request('http://localhost/api/area-restrita/videos/' + id + '/url') as any, {
    params: Promise.resolve({ id }),
  } as any);

beforeEach(() => {
  mockGetCurrentUser.mockReset().mockResolvedValue({ userId: 'u1', role: 'student', email: 'a@b.c' });
  mockFindVideo.mockReset();
  mockFindEnrollment.mockReset();
  mockSign.mockReset().mockResolvedValue('https://r2.example/get?sig=1');
  mockRateLimit.mockReset().mockResolvedValue(undefined);
});

describe('GET /api/area-restrita/videos/[id]/url', () => {
  it('404 se vídeo não existe', async () => {
    mockFindVideo.mockResolvedValue(null);
    const res = await call('v1');
    expect(res.status).toBe(404);
  });

  it('404 se vídeo não é R2 (sem r2Key)', async () => {
    mockFindVideo.mockResolvedValue({ id: 'v1', courseId: '3', storageType: 'youtube', r2Key: null });
    const res = await call('v1');
    expect(res.status).toBe(404);
  });

  it('403 se aluno não tem matrícula válida', async () => {
    mockFindVideo.mockResolvedValue({ id: 'v1', courseId: '3', storageType: 'r2', r2Key: 'videos/3/x.mp4' });
    mockFindEnrollment.mockResolvedValue(null);
    const res = await call('v1');
    expect(res.status).toBe(403);
    expect(mockSign).not.toHaveBeenCalled();
  });

  it('200 + url assinada com matrícula válida', async () => {
    mockFindVideo.mockResolvedValue({ id: 'v1', courseId: '3', storageType: 'r2', r2Key: 'videos/3/x.mp4' });
    mockFindEnrollment.mockResolvedValue({ id: 'e1' });
    const res = await call('v1');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe('https://r2.example/get?sig=1');
    expect(json.expiresIn).toBe(7200);
    expect(mockSign).toHaveBeenCalledWith('videos/3/x.mp4', 7200, 'GET');
  });

  it('admin acessa sem matrícula', async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: 'a1', role: 'admin', email: 'a@b.c' });
    mockFindVideo.mockResolvedValue({ id: 'v1', courseId: '3', storageType: 'r2', r2Key: 'videos/3/x.mp4' });
    const res = await call('v1');
    expect(res.status).toBe(200);
    expect(mockFindEnrollment).not.toHaveBeenCalled();
  });
});
