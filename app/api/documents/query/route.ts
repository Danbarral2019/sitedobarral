import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { courses } from '@/data/courses';
import { assembleAnswerContext } from '@/lib/rag/answerContext';
import type { QueryFilters, ConversationMessage, DocumentResult } from '@/lib/rag/types';
import {
  validateQuotedCitations,
  buildCitationWarning,
} from '@/lib/embeddings/citation-validator';

import { queryGeminiText } from '@/lib/gemini/cached-client';
import { PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODELS } from '@/lib/gemini/config';
import { generateStream, LEGAL_SAFETY_SETTINGS } from '@/lib/ai';
import { checkRateLimit } from '@/lib/cache/redis-client';
import { enforceAiQuota, type AiQuotaDecision } from '@/lib/cache/ai-quota';
import { trackServerEvent } from '@/lib/monitoring/events';
import { apiLogger } from '@/lib/logger';
import { isRateLimitError } from '@/lib/ai/error-detection';
import type { LegalSource } from '@/lib/legal-context';

// ===========================
// Types
// ===========================

interface QueryRequest {
  query: string;
  filters?: QueryFilters;
  maxResults?: number;
  includeContent?: boolean;
  useCache?: boolean;
  conversationHistory?: ConversationMessage[];
  stream?: boolean;
}

interface QueryResponse {
  success: boolean;
  results: DocumentResult[];
  totalDocuments: number;
  cached: boolean;
  latency: number;
  query: string;
  error?: string;
  /** Código machine-readable para classificação de falhas pelo frontend.
   *  'QUOTA_EXHAUSTED' = Gemini sem cota em todas as keys configuradas. */
  code?: 'QUOTA_EXHAUSTED';
  synthesizedAnswer?: string;
  legalSources?: LegalSource[];
}

// ===========================
// Main Handler
// ===========================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify authentication
    const authResult = await verifyAuth(req);

    if (!authResult.valid || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.user.userId;

    // 2. Rate limiting (10 queries per minute for non-admins)
    if (authResult.user.role !== 'admin') {
      const rateLimitKey = `query-rate-limit:${userId}`;
      const rateLimitResult = await checkRateLimit(
        rateLimitKey,
        10,
        60,
        { failureMode: 'closed' },
      );

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Maximum 10 queries per minute.'
          },
          { status: 429 }
        );
      }
    }

    // 2b. Quota anti-abuso por tier (Camada B) + kill-switch global (Camada C).
    // Não bloqueia: retorna decisão de degradação consumida abaixo pela síntese.
    // - allow: Claude Sonnet 5 + Citations (fallback Gemini).
    // - degrade-gemini: pula o Claude → responde direto pelo Gemini (mais barato).
    // - degrade-search: pula a síntese → só resultados de busca (sem card de IA).
    const quotaDecision: AiQuotaDecision = await enforceAiQuota(
      userId,
      authResult.user.role,
    );

    // 3. Parse request body
    const body: QueryRequest = await req.json();
    const {
      query,
      filters = {},
      maxResults = 5,
      useCache = true,
      conversationHistory,
      stream: wantStream = false,
    } = body;

    // 4. Validate query
    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query must be at least 3 characters long'
        },
        { status: 400 }
      );
    }

    if (maxResults < 1 || maxResults > 40) {
      return NextResponse.json(
        {
          success: false,
          error: 'maxResults must be between 1 and 40'
        },
        { status: 400 }
      );
    }

    // 4a. BIA-0c: matrículas do usuário para pós-filtrar o retrieval por acesso
    // (mesmo gate do BIA-0b na lista). Admin recebe todos os cursos. Sem isso, o
    // card de IA citaria material restrito de cursos não matriculados.
    const isAdmin = authResult.user.role === 'admin';
    const enrolledCourseIds = isAdmin
      ? courses.map((c) => c.id)
      : (
          await prisma.user.findUnique({
            where: { id: userId },
            select: { enrollments: { select: { courseId: true } } },
          })
        )?.enrollments.map((e) => e.courseId) ?? [];

    // 4b-12b. Montagem do contexto (retrieval + contexto em camadas + prompt +
    // fontes) extraída para lib/rag/answerContext — mesma função usada pelo eval.
    apiLogger.info({ userId, query, filters, enrolledCourseCount: enrolledCourseIds.length }, 'Document query started');
    const ctx = await assembleAnswerContext({ query, filters, maxResults, conversationHistory, useCache, enrolledCourseIds });

    if (ctx.empty) {
      return NextResponse.json<QueryResponse>({
        success: true,
        results: [],
        totalDocuments: 0,
        cached: ctx.cached,
        latency: Date.now() - startTime,
        query,
      });
    }

    const {
      systemInstruction,
      synthesisPrompt,
      formattedResults,
      legalSources,
      allDisplayResults,
      maxSimilarity,
      citationDocuments,
    } = ctx;

    // Fase 3: sintetizador padrão = Claude Sonnet 5 com Citations API (fontes
    // verificadas por afirmação). Env AI_SYNTHESIS_MODEL permite override/rollback.
    const CITATIONS_MODEL = (process.env.AI_SYNTHESIS_MODEL || 'claude-sonnet-5').trim();

    // 13. Streaming response (SSE) — via lib/ai generateStream com fallback
    // cascade + safety + thinkingBudget=0 (Gemini 2.5/3 trunca sem isso).
    if (wantStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send metadata first
            const meta = JSON.stringify({
              type: 'meta',
              results: formattedResults,
              legalSources: legalSources.length > 0 ? legalSources : undefined,
              totalDocuments: ctx.totalFound,
              query,
            });
            controller.enqueue(encoder.encode(`data: ${meta}\n\n`));

            // Kill-switch global (Camada C): degrada para busca-sem-IA. Emite
            // evento estruturado (frontend esconde o card de síntese) e encerra
            // sem chamar LLM nenhum. Os resultados de busca já foram no `meta`.
            if (quotaDecision.action === 'degrade-search') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'degraded',
                    code: 'AI_QUOTA_DEGRADED',
                    scope: quotaDecision.reason,
                    message: 'Assistente IA em alta demanda no momento. A busca segue funcionando normalmente.',
                  })}\n\n`,
                ),
              );
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              return;
            }

            // 13. Síntese padrão (Fase 3): Claude Sonnet 5 + Citations API —
            // fontes verificadas por afirmação (cited_text ∈ fonte). Fallback
            // para Gemini (sem citações) se o Claude falhar ANTES de emitir tokens.
            let hasTokens = false;
            let fullAnswer = '';
            let finishReason: string | undefined;
            let usedCitations = false;

            const pump = async (
              streamResult: Awaited<ReturnType<typeof generateStream>>,
            ) => {
              for await (const chunk of streamResult) {
                if (chunk.text) {
                  hasTokens = true;
                  fullAnswer += chunk.text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'token', text: chunk.text })}\n\n`),
                  );
                }
                if (chunk.citation) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'citation', citation: chunk.citation })}\n\n`),
                  );
                }
                if (chunk.finishReason) finishReason = chunk.finishReason;
              }
            };

            // Síntese via Gemini (sem citações). Usada como fallback do Claude
            // e como caminho direto quando a quota do tier degrada para Gemini.
            const runGemini = async () => {
              usedCitations = false;
              await pump(
                await generateStream('chat', {
                  provider: 'gemini',
                  model: PRIMARY_GEMINI_MODEL,
                  fallbackModels: [...FALLBACK_GEMINI_MODELS].filter((m) => m !== PRIMARY_GEMINI_MODEL),
                  systemPrompt: systemInstruction,
                  messages: [{ role: 'user', content: synthesisPrompt }],
                  temperature: 0.5,
                  maxTokens: 8192,
                  thinkingBudget: 0,
                  safetySettings: LEGAL_SAFETY_SETTINGS,
                }),
              );
            };

            if (quotaDecision.action === 'degrade-gemini') {
              // Estourou a quota do tier: responde direto pelo Gemini (barato),
              // sem gastar Claude+Citations.
              await runGemini();
            } else {
              try {
                usedCitations = true;
                await pump(
                  await generateStream('chat', {
                    provider: 'anthropic',
                    model: CITATIONS_MODEL,
                    systemPrompt: systemInstruction,
                    messages: [{ role: 'user', content: `PERGUNTA DO USUÁRIO:\n${query}` }],
                    documents: citationDocuments,
                    maxTokens: 8192,
                  }),
                );
              } catch (claudeErr) {
                if (hasTokens) throw claudeErr; // mid-stream: não dá pra trocar de provider
                apiLogger.warn(
                  { err: claudeErr instanceof Error ? claudeErr.message : String(claudeErr) },
                  'Síntese Claude falhou antes de tokens — fallback para Gemini (sem citações)',
                );
                await runGemini();
              }
            }

            // finishReason anormal (Gemini RECITATION/SAFETY; Claude refusal).
            const NORMAL_FINISH = ['STOP', 'MAX_TOKENS', 'end_turn', 'max_tokens', 'stop_sequence'];
            if (finishReason && !NORMAL_FINISH.includes(finishReason)) {
              apiLogger.warn({ finishReason, hasTokens, usedCitations }, 'Síntese interrompida antes do fim normal');
              const note = hasTokens
                ? `\n\n⚠️ (Resposta interrompida antes do final — motivo: ${finishReason}.)`
                : `Não consegui gerar uma síntese (motivo: ${finishReason}). Consulte as fontes abaixo.`;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: note })}\n\n`));
            }

            if (!hasTokens) {
              const fallback = 'Não consegui sintetizar uma resposta agora. Consulte as fontes abaixo — elas contêm a informação relevante para sua pergunta.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fallback })}\n\n`));
            }

            // Validador anti-alucinação de aspas: só no caminho SEM Citations
            // (fallback Gemini). Com Claude+Citations as aspas já são verificadas
            // estruturalmente pela API (cited_text ∈ fonte).
            if (!usedCitations && hasTokens && fullAnswer.length > 0) {
              try {
                const contextChunks = allDisplayResults.map((r) => r.chunkContent);
                const validation = validateQuotedCitations(fullAnswer, contextChunks);
                if (validation.invalidQuotes.length > 0) {
                  apiLogger.warn(
                    {
                      query: query.slice(0, 200),
                      totalQuotes: validation.totalQuotes,
                      invalidQuotes: validation.invalidQuotes.map((q) => q.slice(0, 120)),
                      maxSimilarity,
                    },
                    'Citation validation: aspas não encontradas nos chunks de contexto',
                  );
                  const warning = buildCitationWarning(validation.invalidQuotes);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: warning })}\n\n`));
                }
              } catch (err) {
                apiLogger.error({ err }, 'Citation validator falhou — segue sem aviso');
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (err) {
            apiLogger.error({ error: err }, 'SSE streaming error');

            // Quota Gemini esgotada mid-stream (ou na iniciação do stream).
            // Emite evento de erro estruturado em vez do token genérico — o
            // frontend distingue por code='QUOTA_EXHAUSTED' e mostra mensagem
            // amigável + esconde o card de síntese IA.
            if (isRateLimitError(err)) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'error',
                    code: 'QUOTA_EXHAUSTED',
                    message: 'Síntese IA temporariamente indisponível por excesso de uso. A busca textual segue funcionando — tente novamente em alguns minutos.',
                  })}\n\n`,
                ),
              );
            } else {
              const fallback = 'Não consegui sintetizar uma resposta agora. Consulte as fontes abaixo — elas contêm a informação relevante para sua pergunta.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fallback })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } finally {
            controller.close();
          }
        },
      });

      const latency = Date.now() - startTime;
      apiLogger.info({ resultCount: formattedResults.length, legalSourceCount: legalSources.length, latency }, 'Streaming response sent');
      trackServerEvent('ai_search', { resultCount: formattedResults.length, streaming: true });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 14. Non-streaming response (JSON)
    let synthesizedAnswer: string | undefined;

    // Kill-switch global: não sintetiza, retorna só os resultados de busca.
    if (quotaDecision.action === 'degrade-search') {
      const latency = Date.now() - startTime;
      trackServerEvent('ai_search', { resultCount: formattedResults.length });
      return NextResponse.json<QueryResponse>({
        success: true,
        results: formattedResults,
        totalDocuments: ctx.totalFound,
        cached: ctx.cached,
        latency,
        query,
        legalSources: legalSources.length > 0 ? legalSources : undefined,
      });
    }

    try {
      const geminiResult = await queryGeminiText(synthesisPrompt, {
        temperature: 0.5,
        maxOutputTokens: 8192,
        thinkingBudget: 0,
        useCache,
        systemInstruction,
      });
      synthesizedAnswer = geminiResult.response;
    } catch (error) {
      apiLogger.error({ error }, 'Gemini synthesis failed');
      // Quota Gemini esgotada durante a síntese: re-lança pra o outer catch
      // classificar como 503 + code='QUOTA_EXHAUSTED'. Outros erros (safety,
      // network) ficam silenciosos — endpoint ainda retorna documentos no
      // resultado, só sem síntese IA.
      if (isRateLimitError(error)) throw error;
    }

    const latency = Date.now() - startTime;

    apiLogger.info({ resultCount: formattedResults.length, legalSourceCount: legalSources.length, latency }, 'Query response sent');
    trackServerEvent('ai_search', { resultCount: formattedResults.length });

    return NextResponse.json<QueryResponse>({
      success: true,
      results: formattedResults,
      totalDocuments: ctx.totalFound,
      cached: ctx.cached,
      latency,
      query,
      synthesizedAnswer,
      legalSources: legalSources.length > 0 ? legalSources : undefined,
    });

  } catch (error) {
    apiLogger.error({ error }, 'Document query failed');

    // Quota Gemini esgotada em todas as keys configuradas — degrada
    // graciosamente. Frontend trata 503 + code='QUOTA_EXHAUSTED' para
    // esconder card IA e mostrar mensagem amigável; resultados textuais
    // via /api/area-restrita/global-search seguem funcionando.
    if (isRateLimitError(error)) {
      return NextResponse.json<QueryResponse>(
        {
          success: false,
          code: 'QUOTA_EXHAUSTED',
          error: 'Síntese IA temporariamente indisponível por excesso de uso. A busca textual segue funcionando — tente novamente em alguns minutos.',
          results: [],
          totalDocuments: 0,
          cached: false,
          latency: Date.now() - startTime,
          query: '',
        },
        { status: 503 }
      );
    }

    return NextResponse.json<QueryResponse>(
      {
        success: false,
        results: [],
        totalDocuments: 0,
        cached: false,
        latency: Date.now() - startTime,
        query: '',
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
