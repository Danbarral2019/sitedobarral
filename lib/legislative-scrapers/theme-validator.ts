/**
 * Validador puro para respostas de LLM classificando temas de atos normativos.
 *
 * Cobre o risco de o modelo:
 * - Inventar novos valores fora da taxonomia canônica
 * - Retornar estrutura inesperada
 * - Retornar mais temas do que o prompt pediu
 */

export const CANONICAL_THEMES = [
  'principios-gerais',
  'agentes-governanca',
  'planejamento',
  'pesquisa-precos',
  'modalidades',
  'pregao-eletronico',
  'contratacao-direta',
  'registro-precos',
  'contratos',
  'gestao-fiscalizacao',
  'sancoes',
  'sustentabilidade',
  'tecnologia-informacao',
  'obras-engenharia',
  'controle-transparencia',
] as const;

const CANONICAL_SET = new Set<string>(CANONICAL_THEMES);

const MAX_THEMES = 4;

export interface ValidationResult {
  ok: boolean;
  themes?: string[];
  reason?: string;
}

/**
 * Valida o objeto retornado pelo LLM. Aceita 0..MAX_THEMES valores;
 * todos devem estar em CANONICAL_THEMES. Deduplica preservando ordem.
 */
export function validateThemes(raw: unknown): ValidationResult {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, reason: 'raw is not an object' };
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.themes)) {
    return { ok: false, reason: 'missing "themes" array' };
  }
  if (obj.themes.length > MAX_THEMES) {
    return { ok: false, reason: `too many themes (${obj.themes.length} > ${MAX_THEMES})` };
  }
  const out: string[] = [];
  for (const item of obj.themes) {
    if (typeof item !== 'string') {
      return { ok: false, reason: `non-string theme: ${JSON.stringify(item)}` };
    }
    if (!CANONICAL_SET.has(item)) {
      return { ok: false, reason: `unknown theme: "${item}"` };
    }
    if (!out.includes(item)) out.push(item);
  }
  return { ok: true, themes: out };
}
