import crypto from 'node:crypto';

function getSecret(): string {
  const secret = process.env.CLIPPING_UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    throw new Error('CLIPPING_UNSUBSCRIBE_SECRET (ou NEXTAUTH_SECRET / CRON_SECRET) não configurado');
  }
  return secret;
}

function base64UrlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf-8');
}

export function signUnsubscribeToken(userId: string): string {
  const payload = base64UrlEncode(userId);
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64');
  const sigUrl = sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${payload}.${sigUrl}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64');
  const expectedUrl = expectedSig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedUrl);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const userId = base64UrlDecode(payload);
    if (!userId || userId.length < 8 || userId.length > 100) return null;
    return userId;
  } catch {
    return null;
  }
}
