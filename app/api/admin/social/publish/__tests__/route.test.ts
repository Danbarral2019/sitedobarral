// @vitest-environment node
/**
 * /api/admin/social/publish no padrão da Fase 8: falha de publicação nas
 * plataformas continua 500, com a mensagem em `error` e o resultado por
 * plataforma em `details.results`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockVerifyToken = vi.fn();
vi.mock('@/lib/auth', () => ({ verifyToken: (...a: unknown[]) => mockVerifyToken(...a) }));

const mockPublish = vi.fn();
vi.mock('@/lib/social-publisher', () => ({
  publishToSocialMedia: (...a: unknown[]) => mockPublish(...a),
}));

import { POST } from '../route';

function req(body: unknown, comToken = true) {
  const r = new NextRequest('http://localhost/api/admin/social/publish', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (comToken) r.cookies.set('auth-token', 'tok');
  return r;
}

describe('/api/admin/social/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'a1', role: 'admin' });
  });

  it('401 sem token', async () => {
    const res = await POST(req({ blogPostId: 'b1' }, false));
    expect(res.status).toBe(401);
  });

  it('400 sem blogPostId', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('blogPostId é obrigatório');
  });

  it('500 com o resultado por plataforma quando a publicação falha', async () => {
    const results = [{ platform: 'linkedin', success: false, error: 'token expirado' }];
    mockPublish.mockResolvedValue({ success: false, message: 'Falha no LinkedIn', results });
    const res = await POST(req({ blogPostId: 'b1' }));
    expect(res.status).toBe(500);
    const corpo = await res.json();
    expect(corpo.error).toBe('Falha no LinkedIn');
    expect(corpo.code).toBe('SOCIAL_PUBLISH_FAILED');
    expect(corpo.details).toEqual({ results });
  });
});
