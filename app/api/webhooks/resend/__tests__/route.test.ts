// @vitest-environment node
/**
 * Contrato do webhook do Resend (Svix) no padrão da Fase 8: 400 sem headers
 * ou com JSON inválido, 503 sem secret, 401 com assinatura inválida, 500 em
 * falha de processamento e 200 no recebido ou duplicado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockExtract = vi.fn();
const mockVerify = vi.fn();
vi.mock('@/lib/webhooks/svix', () => ({
  extractSvixHeaders: (...a: unknown[]) => mockExtract(...a),
  verifySvixSignature: (...a: unknown[]) => mockVerify(...a),
}));

const mockDedupCreate = vi.fn();
const mockDedupUpdate = vi.fn();
const mockSubscriberUpdateMany = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    processedWebhookEvent: {
      create: (...a: unknown[]) => mockDedupCreate(...a),
      update: (...a: unknown[]) => mockDedupUpdate(...a),
    },
    newsletterSubscriber: { updateMany: (...a: unknown[]) => mockSubscriberUpdateMany(...a) },
    newsletterSend: { updateMany: vi.fn() },
  },
}));

import { POST } from '../route';

function req(body: string) {
  return new NextRequest('http://localhost/api/webhooks/resend', { method: 'POST', body });
}

const BOUNCE = JSON.stringify({ type: 'email.bounced', data: { to: ['a@b.com'] } });

describe('/api/webhooks/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_dGVzdGU=');
    mockExtract.mockReturnValue({ id: 'msg_1', timestamp: '1', signature: 'v1,x' });
    mockVerify.mockReturnValue({ valid: true });
    mockDedupCreate.mockResolvedValue({});
    mockDedupUpdate.mockResolvedValue({});
    mockSubscriberUpdateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('400 sem os headers svix', async () => {
    mockExtract.mockReturnValue(null);
    const res = await POST(req(BOUNCE));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing svix headers');
  });

  it('503 sem RESEND_WEBHOOK_SECRET', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
    const res = await POST(req(BOUNCE));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('Webhook secret not configured');
  });

  it('401 com assinatura inválida', async () => {
    mockVerify.mockReturnValue({ valid: false, reason: 'signature mismatch' });
    const res = await POST(req(BOUNCE));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid signature');
  });

  it('400 com JSON inválido', async () => {
    const res = await POST(req('{nao-json'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body');
  });

  it('200 e dedup:true para evento repetido', async () => {
    mockDedupCreate.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    const res = await POST(req(BOUNCE));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, dedup: true });
  });

  it('200 no bounce processado', async () => {
    const res = await POST(req(BOUNCE));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mockSubscriberUpdateMany).toHaveBeenCalled();
  });

  it('500 quando o processamento falha', async () => {
    mockSubscriberUpdateMany.mockRejectedValue(new Error('banco fora do ar'));
    const res = await POST(req(BOUNCE));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Webhook processing failed');
  });
});
