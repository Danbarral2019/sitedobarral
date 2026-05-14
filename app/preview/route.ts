import { NextRequest, NextResponse } from 'next/server';
import { hashPreviewKey } from '@/lib/middleware/coming-soon';

/**
 * GET /preview?key=XXX
 *
 * Bypass do coming-soon de pré-lançamento. Marketing recebe a URL
 * com a chave em env e clica → seta cookie httpOnly de 60 dias →
 * redirect para /. Chave inválida retorna 404 (anti-fuzz, não 401).
 *
 * Cookie value = sha256(PREVIEW_BYPASS_KEY) — trocar a env var
 * automaticamente invalida todos os cookies emitidos.
 *
 * Comparação constant-time via hash: hashea ambas as entradas e
 * compara byte-a-byte com OR acumulado, fechando o vetor de timing
 * attack mesmo num runtime onde o ganho é marginal.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const expected = process.env.PREVIEW_BYPASS_KEY;

  if (!key || !expected) {
    return new NextResponse(null, { status: 404 });
  }

  const encoder = new TextEncoder();
  const [keyHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(key)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);

  if (!buffersEqual(keyHash, expectedHash)) {
    return new NextResponse(null, { status: 404 });
  }

  const cookieValue = await hashPreviewKey(expected);

  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set('preview-bypass', cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 60, // 60 dias
    path: '/',
  });
  return response;
}

function buffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}
