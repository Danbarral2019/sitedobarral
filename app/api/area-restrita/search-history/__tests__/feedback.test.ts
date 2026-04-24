// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFindUnique,
  mockUpdate,
  mockVerifyAuth,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockVerifyAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    searchHistory: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  verifyAuth: (...args: any[]) => mockVerifyAuth(...args),
}));

import { PATCH } from '@/app/api/area-restrita/search-history/[id]/feedback/route';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/area-restrita/search-history/abc/feedback', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
  mockVerifyAuth.mockReset();

  mockVerifyAuth.mockResolvedValue({
    valid: true,
    user: { userId: 'u1', email: 'u@x.com', role: 'student' },
  });
  mockFindUnique.mockResolvedValue({ userId: 'u1' });
  mockUpdate.mockResolvedValue({});
});

const context = { params: Promise.resolve({ id: 'sh-1' }) };

describe('PATCH /api/area-restrita/search-history/[id]/feedback', () => {
  it('aceita feedback=1 e chama update com feedbackAt set', async () => {
    const res = await PATCH(makeReq({ feedback: 1 }) as any, context);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sh-1' },
        data: expect.objectContaining({
          feedback: 1,
          feedbackAt: expect.any(Date),
        }),
      }),
    );
  });

  it('aceita feedback=-1', async () => {
    const res = await PATCH(makeReq({ feedback: -1 }) as any, context);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ feedback: -1 }) }),
    );
  });

  it('aceita feedback=null (clear) e seta feedbackAt=null', async () => {
    const res = await PATCH(makeReq({ feedback: null }) as any, context);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feedback: null, feedbackAt: null }),
      }),
    );
  });

  it('rejeita valores inválidos de feedback (ex: 5, string)', async () => {
    const res1 = await PATCH(makeReq({ feedback: 5 }) as any, context);
    expect(res1.status).toBe(400);
    const res2 = await PATCH(makeReq({ feedback: 'bad' }) as any, context);
    expect(res2.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('aceita note opcional e trunca a 500 chars', async () => {
    const longNote = 'x'.repeat(800);
    const res = await PATCH(
      makeReq({ feedback: -1, note: longNote }) as any,
      context,
    );
    expect(res.status).toBe(200);
    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.feedbackNote.length).toBe(500);
  });

  it('retorna 404 quando a entrada não é do usuário', async () => {
    mockFindUnique.mockResolvedValueOnce({ userId: 'outro-usuario' });
    const res = await PATCH(makeReq({ feedback: 1 }) as any, context);
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('retorna 401 sem auth', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ valid: false });
    const res = await PATCH(makeReq({ feedback: 1 }) as any, context);
    expect(res.status).toBe(401);
  });
});
