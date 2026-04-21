import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { queryGeminiText } from '@/lib/gemini/cached-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/admin/gemini-test
 *
 * Health check simples do Gemini. Faz uma chamada mínima e retorna
 * latência + resposta, ou o erro completo. Para diagnosticar rapidamente
 * se a chave / quota / modelo está OK em produção/preview.
 *
 * Apenas admin.
 */
export const GET = withAuth(async (_request: NextRequest, context?: Record<string, unknown>) => {
  const user = context?.user as { userId: string; role?: string };
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });
  }

  const hasKey = !!process.env.GEMINI_API_KEY;
  const hasRedisUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasRedisToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!hasKey) {
    return NextResponse.json({
      ok: false,
      reason: 'GEMINI_API_KEY_MISSING',
      env: { hasKey, hasRedisUrl, hasRedisToken },
    }, { status: 503 });
  }

  const started = Date.now();
  try {
    const result = await queryGeminiText(
      'Responda em uma única palavra: qual é a capital do Brasil?',
      {
        model: 'gemini-2.0-flash',
        temperature: 0,
        maxOutputTokens: 20,
        useCache: false,
      }
    );
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
      response: result.response?.trim() || '(vazio)',
      env: { hasKey, hasRedisUrl, hasRedisToken },
      model: 'gemini-2.0-flash',
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - started,
      reason: 'GEMINI_CALL_FAILED',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      env: { hasKey, hasRedisUrl, hasRedisToken },
      model: 'gemini-2.0-flash',
    }, { status: 500 });
  }
});
