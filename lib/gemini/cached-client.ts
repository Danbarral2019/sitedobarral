/**
 * Cached Gemini Client
 *
 * Wraps Gemini API calls with Redis caching layer
 * Used for text synthesis (answers based on semantic search context)
 */

import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/genai';
import { withCache, CacheKeys, CACHE_TTL } from '../cache/redis-client';
import {
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODELS,
  shouldTryFallbackModel,
  isRateLimitError,
} from './config';

// ===========================
// Configuration
// ===========================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Lazy-loaded client (validated on first use)
let genAI: GoogleGenAI | null = null;

function validateGeminiConfig() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
}

function getGenAI(): GoogleGenAI {
  validateGeminiConfig();
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });
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
  /**
   * Controla o "thinking mode" dos modelos Gemini 2.5+ / 3.x.
   *
   * **Default agora é `0` (thinking desativado)** — Gemini consome ~1.500 tokens
   * em raciocínio interno antes do output visível e, com `maxOutputTokens`
   * baixo, trunca JSON/texto silenciosamente. Esse default protege novos
   * call-sites do bug que sabotou o `LeiIndexer` por meses (auditoria
   * 2026-05-16, P0.1).
   *
   * Valores:
   *   - `0` (default): desativa thinking. Use para classificação, extração,
   *     resumo curto, parsing de JSON estruturado, expansão de queries.
   *   - `-1`: ativa dynamic thinking (modelo decide o budget). Use em chat
   *     conversacional e raciocínio multi-passo — ex.: chat artigos premium.
   *   - `N > 0`: budget fixo em tokens. Raro. Use só em experimentação.
   */
  thinkingBudget?: number;
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
/**
 * Safety settings permissivos para contexto jurídico profissional. Os
 * padrões do Gemini bloqueiam termos como "sanção", "fraude", "ato
 * ilícito", "responsabilização" — comuns em ementas de TCU/STJ e em
 * conteúdo sobre direito administrativo sancionador. Usamos BLOCK_ONLY_HIGH
 * para evitar falsos positivos sem abrir para conteúdo genuinamente tóxico.
 */
const LEGAL_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

async function callGeminiRaw(
  modelName: string,
  query: string,
  opts: { temperature: number; maxOutputTokens: number; systemInstruction?: string; thinkingBudget?: number },
) {
  const result = await getGenAI().models.generateContent({
    model: modelName,
    contents: query,
    config: {
      ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      ...(opts.thinkingBudget !== undefined && {
        thinkingConfig: { thinkingBudget: opts.thinkingBudget },
      }),
      safetySettings: LEGAL_SAFETY_SETTINGS,
    },
  });

  const candidate = result.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const blockReason = result.promptFeedback?.blockReason;

  if (blockReason) {
    throw new Error(`Gemini blocked prompt: ${blockReason}`);
  }
  if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    throw new Error(`Gemini finished with reason: ${finishReason}`);
  }

  const response = result.text ?? '';

  const usageMetadata = result.usageMetadata;
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
 * Wrapper com retry exponencial para 429. Rajadas momentâneas de TPM/RPM
 * (provocadas por crons concorrentes ou picos locais) se resolvem em 1-3s.
 * Sem retry, a primeira 429 mata a request — daí a UX ruim.
 * Delays: 1.5s, 4s. Máximo 3 tentativas totais.
 */
async function callGeminiOnce(
  modelName: string,
  query: string,
  opts: { temperature: number; maxOutputTokens: number; systemInstruction?: string; thinkingBudget?: number },
) {
  const delaysMs = [1500, 4000];
  let lastErr: unknown;

  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await callGeminiRaw(modelName, query, opts);
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err) || attempt === delaysMs.length) {
        throw err;
      }
      const delay = delaysMs[attempt];
      console.warn(
        `[gemini] "${modelName}" 429 on attempt ${attempt + 1}. Retrying in ${delay}ms.`,
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastErr;
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
  opts: { temperature: number; maxOutputTokens: number; systemInstruction?: string; thinkingBudget?: number },
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
        console.warn(
          `[gemini] Primary model "${requestedModel}" failed; succeeded on fallback "${modelName}".`,
        );
      }
      return { ...result, modelUsed: modelName };
    } catch (err) {
      lastError = err;
      if (!shouldTryFallbackModel(err)) {
        // Erro não recuperável por troca de modelo (safety, auth, rede).
        throw err;
      }
      const reason = isRateLimitError(err) ? 'rate-limit (429)' : 'unavailable';
      console.warn(
        `[gemini] Model "${modelName}" ${reason}. Trying next fallback.`,
      );
    }
  }
  // Se chegou aqui, todos os modelos falharam por disponibilidade/quota.
  if (isRateLimitError(lastError)) {
    throw new Error(
      'Gemini quota esgotada em todos os modelos configurados (HTTP 429). Ative billing em https://console.cloud.google.com/billing ou reduza volume de chamadas.',
    );
  }
  throw lastError ?? new Error('Todos os modelos Gemini indisponíveis');
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
    thinkingBudget = 0,
  } = options;

  const startTime = Date.now();
  const cacheKey = CacheKeys.geminiQuery('text', query);
  const callOpts = { temperature, maxOutputTokens, systemInstruction, thinkingBudget };

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
