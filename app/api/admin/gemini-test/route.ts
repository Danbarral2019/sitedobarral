import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';

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
  const _user = context?.user as { userId: string; role?: string };
  void _user;

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
        model: PRIMARY_GEMINI_MODEL,
        temperature: 0,
        // Auditoria 2026-05-16 P2.4: 20 tokens é menos que o footprint de
        // thinking dos modelos 2.5+/3.x, então a resposta vinha vazia mesmo
        // quando a API estava saudável. 1024 + thinkingBudget=0 é suficiente.
        maxOutputTokens: 1024,
        thinkingBudget: 0,
        useCache: false,
      }
    );
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
      response: result.response?.trim() || '(vazio)',
      env: { hasKey, hasRedisUrl, hasRedisToken },
      model: PRIMARY_GEMINI_MODEL,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - started,
      reason: 'GEMINI_CALL_FAILED',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      env: { hasKey, hasRedisUrl, hasRedisToken },
      model: PRIMARY_GEMINI_MODEL,
    }, { status: 500 });
  }
});
