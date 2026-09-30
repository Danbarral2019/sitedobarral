// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindUnique, mockUpdate, mockSendVerificationEmail } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockSendVerificationEmail: vi.fn(),
}));

vi.mock('@/lib/cache/rate-limit-helper', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args),
}));

import { POST } from '../send-verification/route';

function createRequest(email: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

async function publicBody(res: Response) {
  const data = await res.json();
  // devInfo só existe em NODE_ENV=development
  delete data.devInfo;
  return data;
}

describe('POST /api/auth/send-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockSendVerificationEmail.mockResolvedValue(true);
  });

  it('responde igual para e-mail inexistente, já verificado e pendente', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const inexistente = await POST(createRequest('nao@existe.com'));

    mockFindUnique.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com', name: 'A', emailVerified: true });
    const verificado = await POST(createRequest('a@b.com'));

    mockFindUnique.mockResolvedValueOnce({ id: 'u2', email: 'c@d.com', name: 'C', emailVerified: false });
    const pendente = await POST(createRequest('c@d.com'));

    expect(inexistente.status).toBe(200);
    expect(verificado.status).toBe(200);
    expect(pendente.status).toBe(200);

    const [b1, b2, b3] = await Promise.all([publicBody(inexistente), publicBody(verificado), publicBody(pendente)]);
    expect(b2).toEqual(b1);
    expect(b3).toEqual(b1);
    expect(b2).not.toHaveProperty('alreadyVerified');
  });

  it('só envia o e-mail para conta pendente de verificação', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com', name: 'A', emailVerified: true });
    await POST(createRequest('a@b.com'));
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();

    mockFindUnique.mockResolvedValueOnce({ id: 'u2', email: 'c@d.com', name: 'C', emailVerified: false });
    await POST(createRequest('c@d.com'));
    expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});
