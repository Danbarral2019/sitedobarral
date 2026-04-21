/**
 * Cached Gemini Client
 *
 * Wraps Gemini API calls with Redis caching layer
 * Used for text synthesis (answers based on semantic search context)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { withCache, CacheKeys, CACHE_TTL } from '../cache/redis-client';
import {
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODELS,
  isModelAvailabilityError,
} from './config';

// ===========================
// Configuration
// ===========================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Lazy-loaded client (validated on first use)
let genAI: GoogleGenerativeAI | null = null;

function validateGeminiConfig() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
}

function getGenAI(): GoogleGenerativeAI {
  validateGeminiConfig();
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
  }
  return genAI;
}

// ===========================
// Types
// ===========================

export interface GeminiQueryOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  useCache?: boolean;
  cacheTTL?: number;
  systemInstruction?: string;
}

export interface GeminiQueryResult {
  response: string;
  cached: boolean;
  latency: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// ===========================
// Main Query Function
// ===========================

/**
 * Query Gemini with text prompt (with caching)
 * Used for synthesizing answers based on semantic search context
 */
/**
 * Executa uma chamada direta ao Gemini com um modelo específico.
 * Sem cache, sem fallback. Retorna texto + tokens.
 */
async function callGeminiOnce(
  modelName: string,
  query: string,
  opts: { temperature: number; maxOutputTokens: number; systemInstruction?: string },
) {
  const geminiModel = getGenAI().getGenerativeModel({
    model: modelName,
    ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
    generationConfig: {
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
    },
  });

  const result = await geminiModel.generateContent(query);
  const response = result.response.text();

  const usageMetadata = result.response.usageMetadata;
  const tokens = usageMetadata
    ? {
        prompt: usageMetadata.promptTokenCount || 0,
        completion: usageMetadata.candidatesTokenCount || 0,
        total: usageMetadata.totalTokenCount || 0,
      }
    : undefined;

  return { response, tokens };
}

/**
 * Tenta chamar Gemini com o modelo pedido; se o erro indicar que o modelo
 * não está mais disponível (deprecado, removido), cascateia pelos
 * FALLBACK_GEMINI_MODELS em ordem. Erros de quota/rate-limit/safety NÃO
 * disparam fallback.
 */
async function callGeminiWithFallback(
  requestedModel: string,
  query: string,
  opts: { temperature: number; maxOutputTokens: number; systemInstruction?: string },
) {
  const tryOrder = [
    requestedModel,
    ...FALLBACK_GEMINI_MODELS.filter(m => m !== requestedModel),
  ];

  let lastError: unknown;
  for (let i = 0; i < tryOrder.length; i++) {
    const modelName = tryOrder[i];
    try {
      const result = await callGeminiOnce(modelName, query, opts);
      if (i > 0) {
        // Caiu em fallback — loga warning para Sentry pegar.
        console.warn(
          `[gemini] Primary model "${requestedModel}" unavailable; succeeded on fallback "${modelName}".`,
        );
      }
      return { ...result, modelUsed: modelName };
    } catch (err) {
      lastError = err;
      if (!isModelAvailabilityError(err)) {
        // Erro que não é de disponibilidade (quota, rede, safety, etc.).
        // Não adianta trocar de modelo — rethrow imediato.
        throw err;
      }
      console.warn(
        `[gemini] Model "${modelName}" unavailable (${err instanceof Error ? err.message : String(err)}). Trying next.`,
      );
    }
  }
  // Todos os modelos falharam com erro de disponibilidade.
  throw lastError ?? new Error('All Gemini models unavailable');
}

export async function queryGeminiText(
  query: string,
  options: GeminiQueryOptions = {}
): Promise<GeminiQueryResult> {
  const {
    model = PRIMARY_GEMINI_MODEL,
    temperature = 0.7,
    maxOutputTokens = 2048,
    useCache = true,
    cacheTTL = CACHE_TTL.GEMINI_QUERY,
    systemInstruction,
  } = options;

  const startTime = Date.now();
  const cacheKey = CacheKeys.geminiQuery('text', query);
  const callOpts = { temperature, maxOutputTokens, systemInstruction };

  if (useCache) {
    const cached = await withCache(
      cacheKey,
      async () => {
        const { response, tokens } = await callGeminiWithFallback(model, query, callOpts);
        return { response, tokens };
      },
      cacheTTL
    );

    const latency = Date.now() - startTime;
    return {
      response: cached.response,
      cached: latency < 500,
      latency,
      tokens: cached.tokens,
    };
  }

  const { response, tokens } = await callGeminiWithFallback(model, query, callOpts);
  const latency = Date.now() - startTime;
  return {
    response,
    cached: false,
    latency,
    tokens,
  };
}

// ===========================
// Export
// ===========================

const geminiClient = {
  queryGeminiText,
};
export default geminiClient;
