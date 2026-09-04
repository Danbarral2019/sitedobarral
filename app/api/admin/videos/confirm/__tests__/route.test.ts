// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCurrentUser, mockExists, mockFindFirst, mockCreate, mockRateLimit, mockInvalidate } =
  vi.hoisted(() => ({
    mockGetCurrentUser: vi.fn(),
    mockExists: vi.fn(),
    mockFindFirst: vi.fn(),
    mockCreate: vi.fn(),
    mockRateLimit: vi.fn(),
    mockInvalidate: vi.fn(),
  }));

vi.mock('@/lib/auth', () => ({ getCurrentUser: (...a: any[]) => mockGetCurrentUser(...a) }));
vi.mock('@/lib/storage/r2-client', () => ({ fileExistsInR2: (...a: any[]) => mockExists(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    courseVideo: {
      findFirst: (...a: any[]) => mockFindFirst(...a),
      create: (...a: any[]) => mockCreate(...a),
    },
  },
}));
vi.mock('@/lib/cache/redis-client', () => ({
  CacheInvalidation: { courseVideos: (...a: any[]) => mockInvalidate(...a) },
}));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...a: any[]) => mockRateLimit(...a),
  getClientIp: () => '127.0.0.1',
}));
vi.mock('@/lib/logger', () => ({
  apiLogger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  authLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from '@/app/api/admin/videos/confirm/route';

const okBody = {
  courseId: '3',
  title: 'Aula 1',
  r2Key: 'videos/3/uuid-aula.mp4',
  contentType: 'video/mp4',
  sizeBytes: 123456,
};

function req(body: unknown) {
  return new Request('http://localhost/api/admin/videos/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;
}
const ctx = { params: Promise.resolve({}) } as any;

beforeEach(() => {
  mockGetCurrentUser.mockReset().mockResolvedValue({ userId: 'a1', role: 'admin', email: 'a@b.c' });
  mockExists.mockReset().mockResolvedValue(true);
  mockFindFirst.mockReset().mockResolvedValue({ displayOrder: 4 });
  mockCreate.mockReset().mockResolvedValue({ id: 'cv1' });
  mockRateLimit.mockReset().mockResolvedValue(undefined);
  mockInvalidate.mockReset().mockResolvedValue(undefined);
});

describe('POST /api/admin/videos/confirm', () => {
  it('403 para não-admin', async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: 'u1', role: 'student', email: 'a@b.c' });
    const res = await POST(req(okBody), ctx);
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('400 quando falta campo obrigatório', async () => {
    const { title: _title, ...noTitle } = okBody;
    const res = await POST(req(noTitle), ctx);
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('400 quando r2Key não começa com videos/', async () => {
    const res = await POST(req({ ...okBody, r2Key: 'documents/3/x.pdf' }), ctx);
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('404 quando o arquivo não existe no R2', async () => {
    mockExists.mockResolvedValue(false);
    const res = await POST(req(okBody), ctx);
    expect(res.status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('201 grava CourseVideo r2 com sizeBytes como string e displayOrder incrementado', async () => {
    const res = await POST(req(okBody), ctx);
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.storageType).toBe('r2');
    expect(data.r2Key).toBe('videos/3/uuid-aula.mp4');
    expect(data.sizeBytes).toBe('123456'); // string, não number/BigInt
    expect(data.youtubeUrl).toBeNull();
    expect(data.displayOrder).toBe(5); // last(4) + 1
  });
});
