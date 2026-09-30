/**
 * Tokens assinados da newsletter (double opt-in e descadastro).
 *
 * Formato: `<payload base64url>.<HMAC-SHA256 base64url>`. O HMAC cobre o
 * propósito do token (`confirm` ou `unsubscribe`) mais o payload, de modo que
 * um token de confirmação não serve para descadastrar e vice-versa.
 *
 * - Confirmação: payload `{ s: <subscriberId>, e: <expiração em segundos> }`,
 *   válido por CONFIRMATION_TOKEN_TTL_SECONDS.
 * - Descadastro: payload `{ s: <subscriberId> }`, sem expiração (o link fica em
 *   e-mails antigos e precisa continuar funcionando).
 *
 * Segredo: NEWSLETTER_TOKEN_SECRET, se definido; senão JWT_SECRET (obrigatório
 * no ambiente). Trocar o segredo invalida os links já enviados.
 */

import crypto from 'node:crypto';

export const CONFIRMATION_TOKEN_TTL_SECONDS = 72 * 60 * 60; // 72 horas

type Purpose = 'confirm' | 'unsubscribe';

interface TokenPayload {
  s: string;
  e?: number;
}

function getSecret(): string {
  const secret = process.env.NEWSLETTER_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('NEWSLETTER_TOKEN_SECRET (ou JWT_SECRET) não configurado');
  }
  return secret;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hmac(purpose: Purpose, payload: string): string {
  return toBase64Url(
    crypto.createHmac('sha256', getSecret()).update(`newsletter:${purpose}:${payload}`).digest(),
  );
}

function sign(purpose: Purpose, data: TokenPayload): string {
  const payload = toBase64Url(Buffer.from(JSON.stringify(data), 'utf-8'));
  return `${payload}.${hmac(purpose, payload)}`;
}

function verify(purpose: Purpose, token: unknown): TokenPayload | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > 512) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;

  const expected = Buffer.from(hmac(purpose, payload));
  const received = Buffer.from(sig);
  if (expected.length !== received.length) return null;
  if (!crypto.timingSafeEqual(expected, received)) return null;

  try {
    const data = JSON.parse(fromBase64Url(payload).toString('utf-8')) as TokenPayload;
    if (!data || typeof data.s !== 'string' || data.s.length === 0 || data.s.length > 100) {
      return null;
    }
    if (data.e !== undefined && typeof data.e !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function signConfirmationToken(subscriberId: string, now: Date = new Date()): string {
  const exp = Math.floor(now.getTime() / 1000) + CONFIRMATION_TOKEN_TTL_SECONDS;
  return sign('confirm', { s: subscriberId, e: exp });
}

export type ConfirmationTokenResult =
  | { ok: true; subscriberId: string }
  | { ok: false; reason: 'invalid' | 'expired' };

export function verifyConfirmationToken(
  token: unknown,
  now: Date = new Date(),
): ConfirmationTokenResult {
  const data = verify('confirm', token);
  if (!data || typeof data.e !== 'number') return { ok: false, reason: 'invalid' };
  if (Math.floor(now.getTime() / 1000) > data.e) return { ok: false, reason: 'expired' };
  return { ok: true, subscriberId: data.s };
}

export function signUnsubscribeToken(subscriberId: string): string {
  return sign('unsubscribe', { s: subscriberId });
}

export function verifyUnsubscribeToken(token: unknown): string | null {
  const data = verify('unsubscribe', token);
  return data ? data.s : null;
}
