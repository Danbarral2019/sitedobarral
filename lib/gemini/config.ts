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
 * Modelo "premium" (Gemini 3.1 Pro) para queries de raciocínio profundo.
 * Custa ~6x mais que o Flash, então só ativar onde compense:
 *   - Chat jurídico em queries complexas (heurística em isPremiumChatQuery)
 *   - Detector IA de relações (opt-in via USE_PREMIUM_FOR_DETECTOR)
 *
 * Override via env GEMINI_PREMIUM_MODEL para rollback / experimentação.
 */
export const PREMIUM_GEMINI_MODEL =
  process.env.GEMINI_PREMIUM_MODEL || 'gemini-3.1-pro-preview';

/**
 * Heurística simples para decidir se uma query do chat de artigos vale
 * o custo extra do modelo premium. Default desligado — só ativa quando
 * USE_PREMIUM_FOR_CHAT=true. Quando ativado, rotaciona para premium em
 * queries que combinem 1+ dos critérios:
 *
 *   - Comprimento ≥ 200 caracteres (perguntas extensas tendem a precisar
 *     de raciocínio multi-passo)
 *   - Verbos analíticos: comparar, relacionar, interpretar, fundamentar,
 *     diferenciar, implicações, hipótese
 *
 * Conservador por design — falsos negativos vão para Flash (mais barato),
 * o que é OK; falsos positivos custam ~6× mais.
 */
const PREMIUM_TRIGGER_PATTERNS = [
  /\bcompar/i,
  /\brela[cç][aã]o/i,
  /\binterpret/i,
  /\bfundament/i,
  /\bdiferen[cç]/i,
  /\bimplic/i,
  /\bhip[oó]tese/i,
  /\banalis/i,
  /\bcontradi[cç]/i,
  /\baplicabilidade/i,
];

export function isPremiumChatQuery(query: string): boolean {
  if (process.env.USE_PREMIUM_FOR_CHAT !== 'true') return false;
  if (!query) return false;
  if (query.length >= 200) return true;
  return PREMIUM_TRIGGER_PATTERNS.some((re) => re.test(query));
}

/**
 * Decide se o detector IA de relações deve usar o modelo premium.
 * Default off — ative com USE_PREMIUM_FOR_DETECTOR=true. Detector roda
 * em batch (cron semanal + script de import), então quando ativado o
 * impacto de custo é fixo no volume de atos novos por semana — não
 * proporcional a tráfego de usuário.
 */
export function isPremiumDetectorEnabled(): boolean {
  return process.env.USE_PREMIUM_FOR_DETECTOR === 'true';
}
