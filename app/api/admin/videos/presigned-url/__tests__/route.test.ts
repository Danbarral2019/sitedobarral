// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetCurrentUser, mockPresign, mockRateLimit } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockPresign: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: (...a: any[]) => mockGetCurrentUser(...a) }));
vi.mock('@/lib/storage/r2-client', () => ({
  generatePresignedUploadUrl: (...a: any[]) => mockPresign(...a),
}));
vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: (...a: any[]) => mockRateLimit(...a),
  getClientIp: () => '127.0.0.1',
}));

const { POST } = await import('@/app/api/admin/videos/presigned-url/route');

function req(body: unknown) {
  return new NextRequest('http://localhost/api/admin/videos/presigned-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetCurrentUser.mockReset();
  mockPresign.mockReset().mockResolvedValue('https://r2.example/put?sig=1');
  mockRateLimit.mockReset().mockResolvedValue(undefined);
});

const okBody = { courseId: '3', fileName: 'aula.mp4', fileSize: 1000, fileType: 'video/mp4' };

describe('POST /api/admin/videos/presigned-url', () => {
  it('403 para não-admin', async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: 'u1', role: 'student', email: 'a@b.c' });
    const res = await POST(req(okBody), { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(403);
    expect(mockPresign).not.toHaveBeenCalled();
  });

  it('400 para MIME inválido', async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: 'a1', role: 'admin', email: 'a@b.c' });
    const res = await POST(req({ ...okBody, fileType: 'application/pdf' }), { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
    expect(mockPresign).not.toHaveBeenCalled();
  });

  it('200 + presignedUrl para admin com payload válido', async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: 'a1', role: 'admin', email: 'a@b.c' });
    const res = await POST(req(okBody), { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.presignedUrl).toBe('https://r2.example/put?sig=1');
    expect(json.r2Key).toMatch(/^videos\/3\/.*-aula\.mp4$/);
    expect(json.expiresIn).toBe(900);
  });
});
