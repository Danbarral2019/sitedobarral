/**
 * Configuração central de modelos Gemini — fonte única para todos os
 * call-sites. Quando o Google depreca um modelo, basta mudar aqui.
 *
 * Também exporta a lista de fallbacks. O `cached-client.ts` usa essa
 * lista automaticamente quando detecta erro de "modelo não disponível".
 */

export const PRIMARY_GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Lista ordenada de fallbacks. Se o primary falhar com erro de
 * disponibilidade de modelo, o cliente tenta cada um em ordem.
 * Manter do mais capaz para o menos capaz.
 */
export const FALLBACK_GEMINI_MODELS: ReadonlyArray<string> = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
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
