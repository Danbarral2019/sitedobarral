import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { coletarStj } from '@/lib/stj/coletar';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};

  await withCronTelemetry('sync-stj', async () => {
    // Dois meses por rodada: os dumps são mensais e podem ser republicados
    // depois da primeira publicação. O upsert é idempotente, então reprocessar
    // dispensa cursor de estado.
    const r = await coletarStj({ meses: 2 });
    responseBody = { ok: true, ...r };

    return {
      itemsFound: r.relevantes,
      itemsNew: r.criados,
      itemsError: r.erros,
      metadata: { dumpsLidos: r.dumpsLidos, espelhosVistos: r.espelhosVistos },
    };
  });

  return NextResponse.json(responseBody);
}
