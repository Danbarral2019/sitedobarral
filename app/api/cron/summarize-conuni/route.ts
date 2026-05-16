import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { summarizeRelevantPareceres } from '@/lib/conuni-summary';
import { withCronTelemetry } from '@/lib/cron-telemetry';

/**
 * Cron Job: Gera resumo IA pra pareceres relevantes recém-classificados.
 *
 * Roda toda segunda-feira às 8h UTC. Pega até 200 docs por execução.
 *
 * Schedule + limit calibrados pelo backlog: a auditoria 2026-05-16 P0.3
 * detectou 1.669 docs CONUNI sem `summary`. Com schedule mensal + limit:80
 * o cron drenava ~80/mês enquanto classify-conuni alimentava ~1.500/mês —
 * backlog crescia indefinidamente. Semanal × 150 ≈ ~650/mês, supera o
 * input e zera o backlog em ~13 semanas sem precisar de batch separado.
 *
 * Limit 150 conservador para o orçamento de 300s: cada chamada Gemini Flash
 * ~1.5s + 200ms delay ≈ 1.7s/doc → ~175 docs/run no pior caso. 150 dá folga.
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
        limit: 150,
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
