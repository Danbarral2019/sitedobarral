import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { coletarStj } from '@/lib/stj/coletar';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};

  try {
    await withCronTelemetry('sync-stj', async () => {
      // Dois meses por rodada: os dumps são mensais e podem trazer julgados
      // novos acrescentados a um dump já visto. O upsert é idempotente, então
      // reprocessar dispensa cursor de estado.
      const r = await coletarStj({ meses: 2 });
      responseBody = { ok: true, ...r };

      // Falha total (nenhum dump lido — ex.: WAF do STJ endureceu) precisa virar
      // exceção: é o único jeito de withCronTelemetry gravar `failure` (em vez
      // de `partial_failure`) e acionar o Sentry. Sem isso o cron é inalertável
      // por construção — monitoring-alerts e tribunal-scraper-health só contam
      // status === 'failure'.
      if (r.dumpsLidos === 0) {
        throw new Error(`sync-stj: nenhum dump lido. ${r.mensagensErro.slice(0, 5).join('; ')}`);
      }

      return {
        itemsFound: r.relevantes,
        itemsNew: r.criados,
        itemsError: r.erros,
        errorMessage: r.mensagensErro.length > 0 ? r.mensagensErro.slice(0, 5).join('; ') : undefined,
        metadata: { dumpsLidos: r.dumpsLidos, espelhosVistos: r.espelhosVistos },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
