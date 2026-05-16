import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { summarizeRelevantPareceres } from '@/lib/conuni-summary';
import { withCronTelemetry } from '@/lib/cron-telemetry';

/**
 * Cron Job: Gera resumo IA pra pareceres relevantes recém-classificados.
 *
 * Roda dia 1 às 8h UTC (1h após o classify). Pega até 80 docs por execução.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('summarize-conuni', async () => {
      const result = await summarizeRelevantPareceres(prisma, {
        limit: 80,
        delayMs: 200,
        logger: (msg) => console.log('[Summarize CONUNI]', msg),
      });
      responseBody = {
        message: `Summarize CONUNI: ${result.processed} resumos gerados em ${result.elapsedSeconds}s`,
        ...result,
      };
      return {
        itemsFound: result.processed,
        itemsNew: result.processed - result.errors,
        itemsError: result.errors,
        metadata: { elapsedSeconds: result.elapsedSeconds },
      };
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao gerar resumos CONUNI', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
