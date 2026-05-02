import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { classifyPendingPareceres } from '@/lib/conuni-classify';

/**
 * Cron Job: Classifica novos pareceres CONUNI via Gemini.
 *
 * Roda no dia 1 do mês 1h após o sync CONUNI (que pega ~30-100 docs novos).
 * Limit conservador (80 docs) pra caber no timeout do Vercel (300s);
 * sobras voltam no próximo run.
 *
 * Pula docs com override manual (admin já decidiu) ou já classificados.
 *
 * Segurança: Authorization: Bearer <CRON_SECRET>
 * Agendamento: 1º dia do mês às 7h UTC (1h após sync — vercel.json)
 */

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  console.log('[Classify CONUNI] Iniciando...');

  try {
    const result = await classifyPendingPareceres(prisma, {
      limit: 80,
      delayMs: 200,
      logger: (msg) => console.log('[Classify CONUNI]', msg),
    });

    console.log('[Classify CONUNI] Resultado:', JSON.stringify({
      processed: result.processed,
      relevant: result.relevant,
      irrelevant: result.irrelevant,
      errors: result.errors,
      elapsedSeconds: result.elapsedSeconds,
    }));

    return NextResponse.json({
      message: `Classify CONUNI: ${result.processed} processados (${result.relevant} relevantes, ${result.irrelevant} irrelevantes) em ${result.elapsedSeconds}s`,
      ...result,
    });
  } catch (error) {
    console.error('[Classify CONUNI] Erro fatal:', error);
    return NextResponse.json(
      {
        error: 'Erro ao classificar pareceres CONUNI',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 },
    );
  }
}
