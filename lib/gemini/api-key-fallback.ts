/**
 * Wrapper de fallback entre GEMINI_API_KEY (primária) e GEMINI_API_KEY_BACKUP
 * (secundária, opcional). Quando a primária retorna erro de quota (429 /
 * RESOURCE_EXHAUSTED), tenta automaticamente a backup. Outros erros (auth,
 * network, safety) propagam direto sem cascade.
 *
 * Se apenas uma key estiver configurada, comportamento é idêntico ao atual
 * (1 tentativa só). Se nenhuma estiver configurada, lança erro claro.
 *
 * Uso:
 *   const client = await withGeminiKeyFallback(async (apiKey) => {
 *     const sdk = new GoogleGenAI({ apiKey });
 *     return sdk.models.generateContent({ ... });
 *   });
 */

import { isRateLimitError } from '@/lib/ai/error-detection';
import { apiLogger } from '@/lib/logger';

export async function withGeminiKeyFallback<T>(
  fn: (apiKey: string) => Promise<T>,
): Promise<T> {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP,
  ].filter((k): k is string => typeof k === 'string' && k.length > 0);

  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  let lastErr: unknown;
  for (let i = 0; i < keys.length; i++) {
    try {
      return await fn(keys[i]);
    } catch (err) {
      lastErr = err;
      const isLast = i === keys.length - 1;
      if (isLast || !isRateLimitError(err)) throw err;
      apiLogger.warn(
        { attempt: i + 1, totalKeys: keys.length },
        'gemini.key.quota-exhausted, trying backup',
      );
    }
  }
  throw lastErr;
}
