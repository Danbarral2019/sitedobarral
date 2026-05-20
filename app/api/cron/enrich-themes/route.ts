import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import {
  classifyByHeuristic,
  classifyByAi,
} from '@/lib/legislative-scrapers/theme-enricher';
import { withCronTelemetry } from '@/lib/cron-telemetry';

/**
 * GET /api/cron/enrich-themes
 *
 * Cron semanal de enrichment de themes para atos novos.
 * - Heurística primeiro (articles + keywords): grátis, instantâneo
 * - AI (Claude Haiku 4.5) para residuais: ~$0.001/ato
 *
 * Limite de 20 atos por run para caber no timeout Vercel de 60s.
 *
 * Schedule (vercel.json): '0 4 * * 2' — terça 04:00 UTC (01:00 BRT).
 */

const TAKE_LIMIT = 20;
const AI_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};
  try {
    await withCronTelemetry('enrich-themes', async () => {
      console.log('[Cron EnrichThemes] Iniciando enriquecimento...');

      const acts = await prisma.legislativeAct.findMany({
    where: { themes: null },
    select: { id: true, fullNumber: true, title: true, ementa: true, leiArticles: true, leiArticlesArr: true, content: true },
    take: TAKE_LIMIT,
  });

  console.log(`[Cron EnrichThemes] ${acts.length} atos sem themes (take=${TAKE_LIMIT})`);

  let heuristicHits = 0;
  let aiHits = 0;
  let aiFailed = 0;
  let aiEmpty = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const act of acts) {
    // Passo 1: heurística
    const heuristic = classifyByHeuristic(act);
    if (heuristic.length > 0) {
      await prisma.legislativeAct.update({
        where: { id: act.id },
        data: { themes: JSON.stringify(heuristic) },
      });
      heuristicHits++;
      console.log(`[EnrichThemes] ✓ heurística ${act.fullNumber}: ${JSON.stringify(heuristic)}`);
      continue;
    }

    // Passo 2: AI (delay entre chamadas para ser gentil)
    await sleep(AI_DELAY_MS);
    const aiResult = await classifyByAi(act);
    totalInputTokens += aiResult.tokens?.input ?? 0;
    totalOutputTokens += aiResult.tokens?.output ?? 0;

    if (!aiResult.ok) {
      aiFailed++;
      console.log(`[EnrichThemes] ✗ ai-failed ${act.fullNumber}: ${aiResult.reason}`);
      continue;
    }

    if (aiResult.themes.length === 0) {
      aiEmpty++;
      console.log(`[EnrichThemes] = ai-empty ${act.fullNumber}`);
      continue;
    }

    await prisma.legislativeAct.update({
      where: { id: act.id },
      data: { themes: JSON.stringify(aiResult.themes) },
    });
    aiHits++;
    console.log(`[EnrichThemes] ✓ ai ${act.fullNumber}: ${JSON.stringify(aiResult.themes)}`);
  }

      const summary = {
        processed: acts.length,
        heuristicHits,
        aiHits,
        aiFailed,
        aiEmpty,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
      };
      console.log('[Cron EnrichThemes] Resumo:', summary);
      responseBody = { ok: true, ...summary };
      return {
        itemsFound: acts.length,
        itemsNew: heuristicHits + aiHits,
        itemsError: aiFailed,
        metadata: { aiEmpty, tokens: summary.tokens },
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
