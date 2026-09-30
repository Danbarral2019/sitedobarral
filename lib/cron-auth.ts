import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Compara dois segredos em tempo constante.
 *
 * Os dois lados passam por SHA-256 antes do `timingSafeEqual`, o que iguala os
 * tamanhos dos buffers (o `timingSafeEqual` lança com tamanhos diferentes) e
 * não vaza o comprimento do segredo pelo tempo de resposta.
 */
export function safeCompareSecret(provided: string | null | undefined, expected: string): boolean {
  if (typeof provided !== 'string' || !expected) return false;
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/**
 * Extrai o token de um header `Authorization: Bearer <token>`.
 */
export function bearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/**
 * Verifica autenticação de cron jobs via header Authorization: Bearer <CRON_SECRET>
 *
 * Padrão único para todos os cron routes:
 * - Requer CRON_SECRET configurado no ambiente
 * - Aceita header: Authorization: Bearer <secret>
 * - Compara em tempo constante
 * - Retorna NextResponse 401/500 em caso de erro, ou null se autenticado
 *
 * Uso:
 *   const authError = verifyCronAuth(request);
 *   if (authError) return authError;
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado' },
      { status: 500 }
    );
  }

  if (!safeCompareSecret(bearerToken(request), cronSecret)) {
    return NextResponse.json(
      { error: 'Não autorizado' },
      { status: 401 }
    );
  }

  return null;
}
