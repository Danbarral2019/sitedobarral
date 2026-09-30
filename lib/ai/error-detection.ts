/**
 * Detectores de erro provider-agnostic. Inspecionam mensagem de erro
 * (Anthropic e Gemini SDKs produzem strings parecidas em casos crÃ­ticos:
 * 429 quota, 404 model not found, model deprecated).
 *
 * Usados pelo fallback cascade (`lib/ai/index.ts`) para decidir se vale
 * tentar prÃ³ximo modelo.
 */

export function isRateLimitError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();
  return (
    /\b429\b/.test(msg) ||
    msg.includes('resource exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit')
  );
}

export function isModelAvailabilityError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('is not supported') ||
    msg.includes('deprecated') ||
    msg.includes('not available') ||
    msg.includes('does not exist') ||
    msg.includes('unsupported model') ||
    msg.includes('model_not_found') ||
    /\b404\b/.test(msg) ||
    (/\b400\b/.test(msg) && msg.includes('model'))
  );
}

/**
 * Retorna true se vale tentar prÃ³ximo modelo do fallbackModels.
 * - 429 (quota esgotada) â†' cada modelo Gemini tem quota separada no free
 *   tier, entÃ£o cascade funciona. Anthropic compartilha quota mas o
 *   downgrade pode ainda funcionar.
 * - 404 / model deprecated â†' cascade obrigatÃ³rio.
 * - Outros (safety, auth, network) â†' NÃƒO tenta fallback (erro nÃ£o Ã©
 *   sobre o modelo).
 */
export function shouldTryFallbackModel(err: unknown): boolean {
  return isModelAvailabilityError(err) || isRateLimitError(err);
}

/**
 * Erro que vai se repetir em toda chamada seguinte: cota ou limite de gasto
 * esgotado, ou credencial ausente ou recusada. Scripts em lote devem parar no
 * primeiro, em vez de gastar o resto da fila contra um teto estourado.
 * Inclui "usage limit": a Anthropic responde HTTP 400 com "You have reached
 * your specified API usage limits" quando o limite de gasto da conta estoura.
 */
export function isBudgetOrCredentialError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    isRateLimitError(err) ||
    /spending|usage limit|credit balance|billing|not configured|\b401\b|\b403\b|authentication|api key/i.test(msg)
  );
}
