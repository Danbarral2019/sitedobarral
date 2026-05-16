import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { extractSvixHeaders, verifySvixSignature, type SvixHeaders } from '../svix';

/**
 * Helper que constrói uma assinatura Svix válida para um body+secret específico.
 * Espelha o que o lado servidor do Svix faria ao enviar o webhook.
 */
function signFixture(body: string, secret: string, timestamp: string, id: string): string {
  const secretBase64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const secretBytes = Buffer.from(secretBase64, 'base64');
  const signedContent = `${id}.${timestamp}.${body}`;
  const sig = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  return `v1,${sig}`;
}

const VALID_SECRET = 'whsec_' + Buffer.from('mysecret-32-bytes-of-secret-data!').toString('base64');
const VALID_ID = 'msg_2abc';
const VALID_BODY = '{"type":"email.delivered","data":{"email_id":"abc"}}';

describe('extractSvixHeaders', () => {
  it('extrai os três headers svix-*', () => {
    const req = new Request('https://example.com', {
      headers: {
        'svix-id': 'msg_1',
        'svix-timestamp': '1700000000',
        'svix-signature': 'v1,abc',
      },
    });
    expect(extractSvixHeaders(req)).toEqual({
      id: 'msg_1',
      timestamp: '1700000000',
      signature: 'v1,abc',
    });
  });

  it('retorna null se algum header faltar', () => {
    const req = new Request('https://example.com', {
      headers: { 'svix-id': 'msg_1', 'svix-timestamp': '1700000000' },
    });
    expect(extractSvixHeaders(req)).toBeNull();
  });
});

describe('verifySvixSignature', () => {
  const now = Math.floor(Date.now() / 1000).toString();

  beforeEach(() => {
    vi.useFakeTimers({ now: Date.now() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aceita assinatura válida', () => {
    const headers: SvixHeaders = {
      id: VALID_ID,
      timestamp: now,
      signature: signFixture(VALID_BODY, VALID_SECRET, now, VALID_ID),
    };
    expect(verifySvixSignature(headers, VALID_BODY, VALID_SECRET)).toEqual({ valid: true });
  });

  it('rejeita se secret não foi configurada', () => {
    const headers: SvixHeaders = { id: VALID_ID, timestamp: now, signature: 'v1,abc' };
    expect(verifySvixSignature(headers, VALID_BODY, '')).toEqual({ valid: false, reason: 'missing-secret' });
  });

  it('rejeita assinatura adulterada', () => {
    const sig = signFixture(VALID_BODY, VALID_SECRET, now, VALID_ID);
    const headers: SvixHeaders = { id: VALID_ID, timestamp: now, signature: sig };
    // body diferente do que foi assinado
    expect(verifySvixSignature(headers, '{"tampered":true}', VALID_SECRET)).toEqual({
      valid: false,
      reason: 'invalid-signature',
    });
  });

  it('rejeita assinatura com secret errada', () => {
    const sig = signFixture(VALID_BODY, VALID_SECRET, now, VALID_ID);
    const headers: SvixHeaders = { id: VALID_ID, timestamp: now, signature: sig };
    const wrongSecret = 'whsec_' + Buffer.from('outra-secret-completamente-diferente').toString('base64');
    expect(verifySvixSignature(headers, VALID_BODY, wrongSecret)).toEqual({
      valid: false,
      reason: 'invalid-signature',
    });
  });

  it('rejeita timestamp muito antigo (replay defense)', () => {
    const sixMinAgo = (Math.floor(Date.now() / 1000) - 6 * 60).toString();
    const headers: SvixHeaders = {
      id: VALID_ID,
      timestamp: sixMinAgo,
      signature: signFixture(VALID_BODY, VALID_SECRET, sixMinAgo, VALID_ID),
    };
    expect(verifySvixSignature(headers, VALID_BODY, VALID_SECRET)).toEqual({
      valid: false,
      reason: 'timestamp-too-old',
    });
  });

  it('aceita assinatura quando há múltiplas (rotação de secrets)', () => {
    const validSig = signFixture(VALID_BODY, VALID_SECRET, now, VALID_ID);
    // simulação: cliente envia v1,invalido seguido de v1,valido
    const headers: SvixHeaders = {
      id: VALID_ID,
      timestamp: now,
      signature: `v1,abc123 ${validSig}`,
    };
    expect(verifySvixSignature(headers, VALID_BODY, VALID_SECRET)).toEqual({ valid: true });
  });

  it('aceita secret sem prefixo whsec_', () => {
    const rawSecret = Buffer.from('mysecret-32-bytes-of-secret-data!').toString('base64');
    const headers: SvixHeaders = {
      id: VALID_ID,
      timestamp: now,
      signature: signFixture(VALID_BODY, rawSecret, now, VALID_ID),
    };
    expect(verifySvixSignature(headers, VALID_BODY, rawSecret)).toEqual({ valid: true });
  });

  it('rejeita versão diferente de v1', () => {
    const headers: SvixHeaders = {
      id: VALID_ID,
      timestamp: now,
      signature: 'v2,somehash',
    };
    expect(verifySvixSignature(headers, VALID_BODY, VALID_SECRET)).toEqual({
      valid: false,
      reason: 'invalid-signature',
    });
  });
});
