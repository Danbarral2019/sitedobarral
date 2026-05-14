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
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const expected = process.env.PREVIEW_BYPASS_KEY;

  if (!key || !expected || key !== expected) {
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
