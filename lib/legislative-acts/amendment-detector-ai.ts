/**
 * Detector de relações via Gemini. Usado como fallback/expansão da heurística
 * pra casos sutis que regex não pega (ex: "no que tange aos prazos da norma anterior").
 *
 * Roda só se opt-in (caller passa decisão de quando chamar). Retorna mesma forma
 * que detectAmendments. Modelo: gemini-2.5-flash com response JSON.
 */
import { GoogleGenAI } from '@google/genai';
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

export async function detectAmendmentsAI(ementa: string, content: string): Promise<DetectedRelation[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const text = `${ementa}\n\n${content.slice(0, 8000)}`; // Limita pra evitar custo
  const ai = new GoogleGenAI({ apiKey });

  // Premium opt-in (Gemini 3.1 Pro): mais caro, mas captura mais casos sutis
  // de citação anafórica / verbo não-padrão. Default Flash mantém custo baixo
  // pra cron semanal e batch import. Quando premium ativo, deixa thinking
  // ligado — é justamente o valor que o Pro entrega.
  const usePremium = isPremiumDetectorEnabled();
  const model = usePremium ? PREMIUM_GEMINI_MODEL : 'gemini-3-flash-preview';

  try {
    const response = await ai.models.generateContent({
      model,
      contents: PROMPT.replace('{TEXT}', text),
      config: {
        responseMimeType: 'application/json',
        ...(usePremium ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
      },
    });

    const raw = response.text || '';
    const parsed = JSON.parse(raw) as { relations?: Array<{ type: string; target: string; excerpt: string; confidence: number }> };
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
