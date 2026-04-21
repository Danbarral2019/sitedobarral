import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCronAuth } from '@/lib/cron-auth';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODELS } from '@/lib/gemini/config';

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
      { model, useCache: false, temperature: 0, maxOutputTokens: 10 },
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

  const primaryCheck = await checkModel(PRIMARY_GEMINI_MODEL);

  if (primaryCheck.ok) {
    return NextResponse.json({
      ok: true,
      primary: primaryCheck,
      message: `Primary model "${PRIMARY_GEMINI_MODEL}" está saudável.`,
    });
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

  return NextResponse.json(
    {
      ok: !allFailed,
      primary: primaryCheck,
      fallbacks: fallbackChecks,
      recommendation: allFailed
        ? 'TODOS os modelos falharam. Verifique quota, chave, conectividade.'
        : `Atualizar PRIMARY_GEMINI_MODEL em lib/gemini/config.ts para "${firstWorkingFallback.model}".`,
    },
    { status: allFailed ? 503 : 200 },
  );
}
