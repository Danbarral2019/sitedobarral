/**
 * Detector de relações via Gemini. Usado como fallback/expansão da heurística
 * pra casos sutis que regex não pega (ex: "no que tange aos prazos da norma anterior").
 *
 * Roda só se opt-in (caller passa decisão de quando chamar). Retorna mesma forma
 * que detectAmendments.
 *
 * Provider/modelo resolvidos via `lib/ai` (task=extraction, provider=gemini
 * forçado por chamada). Modelo default vem do registry / env
 * AI_EXTRACTION_MODEL; override por chamada via `opts.model` (útil para
 * scripts comparativos premium vs flash em scripts/compare-detector-models.ts).
 */
import { generate } from '@/lib/ai';
import {
  PREMIUM_GEMINI_MODEL,
  isPremiumDetectorEnabled,
} from '../gemini/config';
import type { DetectedRelation, RelationType } from './amendment-detector';

const PROMPT = `Você é um classificador jurídico. Analise o texto abaixo (ementa + parte do conteúdo) de um ato normativo brasileiro e identifique se ele REVOGA, ALTERA, REGULAMENTA, COMPLEMENTA ou MODIFICA outros atos normativos brasileiros (Leis, Decretos, Portarias, Instruções Normativas, MPs).

Retorne APENAS um JSON no formato:
{"relations": [{"type": "revoga|altera|regulamenta|complementa|modifica", "target": "<fullNumber no padrão 'Lei 14.133/2021' ou 'Decreto 7.892/2013' ou 'IN SEGES 5/2017'>", "excerpt": "<trecho que justifica até 200 chars>", "confidence": <0.5-1.0>}]}

Se não detectar nenhuma, retorne {"relations": []}.

Texto:
---
{TEXT}
---`;

const VALID_TYPES: RelationType[] = ['revoga', 'altera', 'regulamenta', 'complementa', 'modifica'];

export interface DetectAmendmentsAIOptions {
  /**
   * Modelo Gemini para usar. Override do env-flag default.
   * - Sem opção: respeita USE_PREMIUM_FOR_DETECTOR (Flash ou Pro).
   * - Com 'gemini-3-flash-preview': força Flash (com thinkingBudget=0).
   * - Com 'gemini-3.1-pro-preview': força Pro (thinking ativo).
   * Útil pra scripts comparativos (compare-detector-models.ts).
   */
  model?: string;
}

export async function detectAmendmentsAI(
  ementa: string,
  content: string,
  opts: DetectAmendmentsAIOptions = {},
): Promise<DetectedRelation[]> {
  // Guard pré-call: lib/ai lança quando GEMINI_API_KEY ausente; este detector
  // é opt-in e silenciosamente retorna [] para callers (heurística regex roda
  // como fallback). Manter o early-return preserva contrato.
  if (!process.env.GEMINI_API_KEY) return [];

  const text = `${ementa}\n\n${content.slice(0, 8000)}`; // Limita pra evitar custo

  // Premium opt-in (Gemini 3.1 Pro): mais caro, mas captura mais casos sutis
  // de citação anafórica / verbo não-padrão. Default Flash mantém custo baixo
  // pra cron semanal e batch import. Quando premium ativo, deixa thinking
  // ligado — é justamente o valor que o Pro entrega.
  const model =
    opts.model ??
    (isPremiumDetectorEnabled() ? PREMIUM_GEMINI_MODEL : 'gemini-3-flash-preview');
  const isPremium = model === PREMIUM_GEMINI_MODEL;

  try {
    const { text: raw } = await generate('extraction', {
      messages: [{ role: 'user', content: PROMPT.replace('{TEXT}', text) }],
      provider: 'gemini', // força Gemini independente de AI_EXTRACTION_PROVIDER
      model,
      jsonMode: true,
      ...(isPremium ? {} : { thinkingBudget: 0 }),
    });

    const parsed = JSON.parse(raw || '') as { relations?: Array<{ type: string; target: string; excerpt: string; confidence: number }> };
    const relations = parsed.relations ?? [];

    return relations
      .filter((r) => VALID_TYPES.includes(r.type as RelationType))
      .map((r) => ({
        relationType: r.type as RelationType,
        targetFullNumber: r.target,
        excerpt: (r.excerpt ?? '').slice(0, 200),
        confidence: Math.min(1, Math.max(0.5, r.confidence)),
      }));
  } catch {
    return [];
  }
}
