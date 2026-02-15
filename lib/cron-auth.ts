import { NextRequest, NextResponse } from 'next/server';

/**
 * Verifica autenticação de cron jobs via header Authorization: Bearer <CRON_SECRET>
 *
 * Padrão único para todos os cron routes:
 * - Requer CRON_SECRET configurado no ambiente
 * - Aceita header: Authorization: Bearer <secret>
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

  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Não autorizado' },
      { status: 401 }
    );
  }

  return null;
}
