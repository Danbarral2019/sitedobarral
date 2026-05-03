/**
 * Classificador IA editorial pra DOU Clipping v2.
 *
 * Avalia se uma publicação do DOU exige ação de quem gerencia contratos
 * administrativos federais. Substitui o filtro keyword `isProcurementRelated`
 * por um julgamento semântico via Gemini structured output.
 *
 * Spec: docs/superpowers/specs/2026-05-03-dou-clipping-v2-design.md
 */

import { GoogleGenAI, Type } from '@google/genai';
import { PRIMARY_GEMINI_MODEL } from './gemini/config';

export const EDITORIAL_PROMPT_VERSION = 'v1';

export interface EditorialCandidate {
  title: string;
  abstract: string;
  hierarchyStr: string;
}

export interface EditorialClassification {
  score: number;          // 0-100
  reason: string;         // 1-2 frases: por que é (ou não é) relevante
  summary: string;        // 2-3 frases neutras: o que o ato faz
  affects: string[];      // ex: ["Lei 14.133", "contratos vigentes", "PCA"]
  actType: 'decreto' | 'portaria' | 'in' | 'lei' | 'mp' | 'on' | null;
  ambiguous: boolean;     // true quando 50 <= score < 70
}

export interface EditorialBatchResult {
  classifications: EditorialClassification[];
  model: string;
  promptVersion: string;
}

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          reason: { type: Type.STRING },
          summary: { type: Type.STRING },
          affects: { type: Type.ARRAY, items: { type: Type.STRING } },
          actType: {
            type: Type.STRING,
            enum: ['decreto', 'portaria', 'in', 'lei', 'mp', 'on', 'null'],
          },
          ambiguous: { type: Type.BOOLEAN },
        },
        required: ['score', 'reason', 'summary', 'affects', 'actType', 'ambiguous'],
      },
    },
  },
  required: ['items'],
} as const;

// Implementação vem nas próximas tasks
export async function classifyEditorialBatch(
  _candidates: EditorialCandidate[],
  _opts?: { genAI?: GoogleGenAI; model?: string },
): Promise<EditorialBatchResult> {
  throw new Error('not implemented');
}
