import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { syncConuni } from '@/lib/conuni-sync';
import { withCronTelemetry } from '@/lib/cron-telemetry';

/**
 * Cron Job: Sincronização mensal do CONUNI (sucessor do DECOR/AGU)
 *
 * Fetch único da API REST pública (sem auth/captcha) e upsert idempotente
 * dos pareceres, notas técnicas e despachos. Run inicial inseriu 1.512 docs;
 * runs subsequentes só inserem novos (~30-100/mês) e atualizam vigência.
 *
 * Segurança: Authorization: Bearer <CRON_SECRET>
 * Agendamento: 1º dia do mês às 6h UTC (vercel.json)
 */

export const maxDuration = 300; // 5 min

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('sync-conuni', async () => {
      const result = await syncConuni(prisma);
      responseBody = {
        message: `Sync CONUNI: +${result.inserted} inseridos, ${result.updated} atualizados, ${result.skipped} sem mudança em ${result.elapsedSeconds}s`,
        ...result,
      };
      return {
        itemsFound: result.inserted + result.updated + result.skipped,
        itemsNew: result.inserted,
        itemsError: 0,
        metadata: { updated: result.updated, skipped: result.skipped, elapsedSeconds: result.elapsedSeconds },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Erro ao sincronizar CONUNI',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 },
    );
  }
}
