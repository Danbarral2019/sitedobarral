/**
 * Cached Gemini Client
 *
 * Wraps Gemini API calls with Redis caching layer
 * Used for text synthesis (answers based on semantic search context)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { withCache, CacheKeys, CACHE_TTL } from '../cache/redis-client';

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
export async function queryGeminiText(
  query: string,
  options: GeminiQueryOptions = {}
): Promise<GeminiQueryResult> {
  const {
    model = 'gemini-2.0-flash',
    temperature = 0.7,
    maxOutputTokens = 2048,
    useCache = true,
    cacheTTL = CACHE_TTL.GEMINI_QUERY,
  } = options;

  const startTime = Date.now();

  // Generate cache key
  const cacheKey = CacheKeys.geminiQuery('text', query);

  if (useCache) {
    const cached = await withCache(
      cacheKey,
      async () => {
        const geminiModel = getGenAI().getGenerativeModel({
          model,
          generationConfig: {
            temperature,
            maxOutputTokens,
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

        return {
          response,
          tokens,
        };
      },
      cacheTTL
    );

    const latency = Date.now() - startTime;

    return {
      response: cached.response,
      cached: latency < 500, // If faster than 500ms, likely cached
      latency,
      tokens: cached.tokens,
    };
  }

  // No cache: direct query
  const geminiModel = getGenAI().getGenerativeModel({
    model,
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  });

  const result = await geminiModel.generateContent(query);
  const response = result.response.text();
  const latency = Date.now() - startTime;

  const usageMetadata = result.response.usageMetadata;
  const tokens = usageMetadata
    ? {
        prompt: usageMetadata.promptTokenCount || 0,
        completion: usageMetadata.candidatesTokenCount || 0,
        total: usageMetadata.totalTokenCount || 0,
      }
    : undefined;

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
