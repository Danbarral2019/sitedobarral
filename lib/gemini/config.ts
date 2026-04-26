/**
 * Configuração central de modelos Gemini — fonte única para todos os
 * call-sites. Quando o Google depreca um modelo, basta mudar aqui.
 *
 * Também exporta a lista de fallbacks. O `cached-client.ts` usa essa
 * lista automaticamente quando detecta erro de "modelo não disponível".
 */

// Migração para Gemini 3 Flash (2026-04-26):
// - gemini-2.5-flash: deprecação anunciada para 17/jun/2026 (substituto natural)
// - gemini-3-flash-preview: GA em homolog do Google desde dez/2025, próximo Flash
// - thinkingConfig continua suportado, mesma família arquitetural
// Allow override via env GEMINI_PRIMARY_MODEL para rollback rápido sem deploy.
// Ref: https://ai.google.dev/gemini-api/docs/models
export const PRIMARY_GEMINI_MODEL =
  process.env.GEMINI_PRIMARY_MODEL || 'gemini-3-flash-preview';

/**
 * Lista ordenada de fallbacks. Se o primary falhar com erro de
 * disponibilidade OU 429, o cliente tenta cada um em ordem.
 * Manter do mais capaz para o menos capaz.
 *
 * gemini-2.5-flash é o fallback de transição até 17/jun/2026 — depois disso
 * vira 404 e a cascata pula direto para 2.5-flash-lite.
 */
export const FALLBACK_GEMINI_MODELS: ReadonlyArray<string> = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
];

/**
 * Detecta se o erro é de "modelo indisponível/depreciado" — sinal para
 * tentar o próximo modelo da lista. Erros de quota, rate limit, auth ou
 * timeout NÃO entram aqui (não adianta trocar de modelo).
 */
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
 * Detecta HTTP 429 / quota esgotada. No free tier do Gemini, cada modelo
 * tem quota RPM/RPD separada, então trocar para um fallback pode funcionar
 * mesmo quando o primary está esgotado.
 */
export function isRateLimitError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();
  return (
    /\b429\b/.test(msg) ||
    msg.includes('resource exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit')
  );
}

/**
 * Retorna true se o erro justifica tentar o próximo modelo da cascata.
 * Erros de rede, safety, auth NÃO entram aqui.
 */
export function shouldTryFallbackModel(err: unknown): boolean {
  return isModelAvailabilityError(err) || isRateLimitError(err);
}
