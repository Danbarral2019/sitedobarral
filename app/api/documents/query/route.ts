import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

import { verifyAuth } from '@/lib/auth';
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
      const rateLimitResult = await checkRateLimit(rateLimitKey, 10, 60);

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

    // 4b-12b. Montagem do contexto (retrieval + contexto em camadas + prompt +
    // fontes) extraída para lib/rag/answerContext — mesma função usada pelo eval.
    apiLogger.info({ userId, query, filters }, 'Document query started');
    const ctx = await assembleAnswerContext({ query, filters, maxResults, conversationHistory, useCache });

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
    } = ctx;

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

            // Stream Gemini tokens via lib/ai. finishReason chega no chunk
            // terminal (lib/ai provider emite chunk final com finishReason +
            // usage, separado dos chunks de texto).
            const streamResult = await generateStream('chat', {
              messages: [{ role: 'user', content: synthesisPrompt }],
              provider: 'gemini',
              model: PRIMARY_GEMINI_MODEL,
              fallbackModels: [...FALLBACK_GEMINI_MODELS].filter(
                (m) => m !== PRIMARY_GEMINI_MODEL,
              ),
              systemPrompt: systemInstruction,
              temperature: 0.5,
              maxTokens: 8192,
              // Sem thinkingBudget=0, o raciocínio come o maxTokens e a
              // resposta trunca no meio. Síntese factual não precisa de
              // thinking — só cita fontes.
              thinkingBudget: 0,
              safetySettings: LEGAL_SAFETY_SETTINGS,
            });
            let hasTokens = false;
            // Acumula tokens em buffer pra validação pós-stream de citações
            // entre aspas (anti-hallucination). Stream segue normal pro
            // cliente em paralelo — verificação é feita ao final.
            let fullAnswer = '';
            let finishReason: string | undefined;
            for await (const chunk of streamResult) {
              if (chunk.text) {
                hasTokens = true;
                fullAnswer += chunk.text;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'token', text: chunk.text })}\n\n`,
                  ),
                );
              }
              if (chunk.finishReason) {
                finishReason = chunk.finishReason;
              }
            }

            // Verifica finishReason pós-stream. Gemini 2.5 aborta em meio
            // de resposta quando detecta recitação literal (RECITATION) ou
            // safety parcial. Sem esse check, UI exibe resposta truncada
            // sem aviso.
            if (
              finishReason &&
              finishReason !== 'STOP' &&
              finishReason !== 'MAX_TOKENS'
            ) {
              apiLogger.warn(
                { finishReason, hasTokens },
                'Gemini stream interrupted before STOP',
              );
              const note = hasTokens
                ? `\n\n⚠️ (Resposta interrompida antes do final — motivo: ${finishReason}. Tente reformular a pergunta para evitar citação literal.)`
                : `Não consegui gerar uma síntese (motivo: ${finishReason}). Consulte as fontes abaixo.`;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'token', text: note })}\n\n`,
                ),
              );
            }

            if (!hasTokens) {
              const fallback = 'Não consegui sintetizar uma resposta agora. Consulte as fontes abaixo — elas contêm a informação relevante para sua pergunta.';
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fallback })}\n\n`));
            }

            // Validação anti-hallucination: detecta citações entre aspas que
            // não existem nos chunks do contexto e adiciona aviso ao final.
            // Defesa em camadas — independe de o LLM ter respeitado o prompt.
            // Caso fundador: 2026-04-26, Enunciado IBDA 29 com aspas inventadas.
            if (hasTokens && fullAnswer.length > 0) {
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
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'token', text: warning })}\n\n`),
                  );
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
