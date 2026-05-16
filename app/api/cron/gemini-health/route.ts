import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCronAuth } from '@/lib/cron-auth';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODELS } from '@/lib/gemini/config';
import { withCronTelemetry } from '@/lib/cron-telemetry';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ModelCheck {
  model: string;
  ok: boolean;
  latencyMs: number;
  responseSample?: string;
  error?: string;
}

async function checkModel(model: string): Promise<ModelCheck> {
  const started = Date.now();
  try {
    const result = await queryGeminiText(
      'Responda em uma palavra: qual a capital do Brasil?',
      // maxOutputTokens=10 + thinking ligado = sempre vazio nos modelos 2.5+/3.x
      // (thinking consome ~1.5k tokens antes do primeiro caractere visível).
      // 256 + thinkingBudget=0 garante resposta real, sem custo perceptível.
      { model, useCache: false, temperature: 0, maxOutputTokens: 256, thinkingBudget: 0 },
    );
    const txt = (result.response || '').trim();
    return {
      model,
      ok: txt.length > 0,
      latencyMs: Date.now() - started,
      responseSample: txt.slice(0, 50),
    };
  } catch (err) {
    return {
      model,
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * GET /api/cron/gemini-health
 *
 * Cron diário: testa o modelo Gemini primary e, se falhar, todos os
 * fallbacks. Se o primary falhar, captura no Sentry com nível warning
 * (fallback cobriu) ou error (tudo falhou).
 *
 * Permite detectar ANTES dos usuários quando o Google depreca um modelo.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  if (!process.env.GEMINI_API_KEY) {
    Sentry.captureMessage('gemini-health: GEMINI_API_KEY missing', 'error');
    return NextResponse.json(
      { ok: false, reason: 'GEMINI_API_KEY_MISSING' },
      { status: 503 },
    );
  }

  let responseBody: Record<string, unknown> = {};
  let httpStatus = 200;
  try {
    await withCronTelemetry('gemini-health', async () => {
      const primaryCheck = await checkModel(PRIMARY_GEMINI_MODEL);

      if (primaryCheck.ok) {
        responseBody = {
          ok: true,
          primary: primaryCheck,
          message: `Primary model "${PRIMARY_GEMINI_MODEL}" está saudável.`,
        };
        return { itemsFound: 1, itemsNew: 1, metadata: { primary: PRIMARY_GEMINI_MODEL, latencyMs: primaryCheck.latencyMs } };
      }

      // Primary falhou — testa fallbacks em sequência.
      const fallbackChecks: ModelCheck[] = [];
      for (const model of FALLBACK_GEMINI_MODELS) {
        fallbackChecks.push(await checkModel(model));
      }

      const firstWorkingFallback = fallbackChecks.find(c => c.ok);
      const allFailed = !firstWorkingFallback;

      if (allFailed) {
        Sentry.captureMessage(
          `gemini-health: PRIMARY e todos os ${FALLBACK_GEMINI_MODELS.length} fallbacks falharam. Primary err="${primaryCheck.error}"`,
          'error',
        );
      } else {
        Sentry.captureMessage(
          `gemini-health: PRIMARY "${PRIMARY_GEMINI_MODEL}" falhou ("${primaryCheck.error}"). Fallback "${firstWorkingFallback.model}" funcionou — atualizar PRIMARY_GEMINI_MODEL em lib/gemini/config.ts.`,
          'warning',
        );
      }

      responseBody = {
        ok: !allFailed,
        primary: primaryCheck,
        fallbacks: fallbackChecks,
        recommendation: allFailed
          ? 'TODOS os modelos falharam. Verifique quota, chave, conectividade.'
          : `Atualizar PRIMARY_GEMINI_MODEL em lib/gemini/config.ts para "${firstWorkingFallback.model}".`,
      };
      httpStatus = allFailed ? 503 : 200;

      return {
        itemsFound: 1 + FALLBACK_GEMINI_MODELS.length,
        itemsNew: fallbackChecks.filter(c => c.ok).length + (primaryCheck.ok ? 1 : 0),
        itemsError: 1 + fallbackChecks.filter(c => !c.ok).length, // primary + fallbacks que falharam
        metadata: { primaryFailed: true, allFailed, workingFallback: firstWorkingFallback?.model },
      };
    });
    return NextResponse.json(responseBody, { status: httpStatus });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
