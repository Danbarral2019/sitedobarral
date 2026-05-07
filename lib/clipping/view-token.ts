import crypto from 'node:crypto';

function getSecret(): string {
  const secret =
    process.env.CLIPPING_VIEW_SECRET ||
    process.env.CLIPPING_UNSUBSCRIBE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET;
  if (!secret) {
    throw new Error('CLIPPING_VIEW_SECRET (ou fallback NEXTAUTH_SECRET / CRON_SECRET) não configurado');
  }
  return secret;
}

function base64UrlEncode(s: string): string {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf-8');
}

function hmacBase64Url(payload: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function signViewToken(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Data inválida para view token: ${date}`);
  }
  const payload = base64UrlEncode(date);
  const sig = hmacBase64Url(payload);
  return `${payload}.${sig}`;
}

export function verifyViewToken(token: string, expectedDate: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;

  const expectedSig = hmacBase64Url(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;

  try {
    const date = base64UrlDecode(payload);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    return date === expectedDate;
  } catch {
    return false;
  }
}
