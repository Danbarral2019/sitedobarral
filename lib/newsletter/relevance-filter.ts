/**
 * Newsletter Relevance Filter
 *
 * Uses Gemini AI to evaluate and filter acórdãos/decisions by relevance
 * to Lei 14.133/2021 (Licitações e Contratos) study.
 *
 * Selects 10-25 most relevant decisions per newsletter edition (max 30).
 * Generates AI summaries explaining why each decision matters.
 */

import { queryGeminiText } from '@/lib/gemini/cached-client';
import { PRIMARY_GEMINI_MODEL } from '@/lib/gemini/config';

// ===========================
// Types
// ===========================

export interface DecisionInput {
  id: string;
  title: string;
  description: string | null;
  ementa?: string | null;
  summary?: string | null;
  tribunalCode?: string;
  category: string; // 'acordao' for Document, 'tribunal-decisions' for TribunalDecision
}

export interface FilteredDecision {
  id: string;
  title: string;
  tribunalCode: string;
  relevanceScore: number;
  aiSummary: string;
  themes: string[];
  leiArticles: string[];
}

export interface RelevanceFilterResult {
  selected: FilteredDecision[];
  totalEvaluated: number;
  totalSelected: number;
}

// ===========================
// Constants
// ===========================

const BATCH_SIZE = 10;
const MIN_SCORE = 50;
const MIN_DECISIONS = 10;
const MAX_DECISIONS = 30;

const SYSTEM_INSTRUCTION = `Você é um especialista em Direito Administrativo brasileiro, especificamente em Licitações e Contratos Públicos regidos pela Lei nº 14.133/2021.`;

function buildFilterPrompt(decisions: DecisionInput[]): string {
  const decisionsJson = decisions.map(d => ({
    id: d.id,
    title: d.title,
    tribunal: d.tribunalCode || 'TCU',
    ementa: (d.ementa || d.description || '').substring(0, 500),
    summary: (d.summary || '').substring(0, 300),
  }));

  return `Analise as seguintes decisões de tribunais e avalie a relevância de cada uma para o estudo da Lei 14.133/2021 e temas correlatos (licitações, contratos administrativos, pregão eletrônico, dispensa e inexigibilidade, gestão e fiscalização de contratos, sanções administrativas, planejamento de contratações).

Para cada decisão, forneça:
1. relevanceScore (0-100): quão relevante é para o estudo da Lei 14.133/2021
   - 80-100: Decisão paradigmática, tese inovadora, ou interpretação importante de artigo específico
   - 60-79: Relevante, reforça entendimento consolidado com nuances úteis
   - 40-59: Parcialmente relevante, toca no tema mas não é central
   - 0-39: Baixa relevância para o estudo da Lei 14.133
2. aiSummary: Resumo de 2 a 4 frases explicando POR QUE esta decisão importa para quem estuda licitações. Destaque a tese jurídica, o artigo da lei interpretado e a consequência prática.
3. themes: Array de temas (ex: ["dispensa de licitação", "sobrepreço", "pregão eletrônico"])
4. leiArticles: Array de artigos da Lei 14.133 referenciados (ex: ["75", "95", "155"])

DECISÕES PARA AVALIAR:
${JSON.stringify(decisionsJson, null, 2)}

Responda EXCLUSIVAMENTE em JSON válido, no formato:
{
  "evaluations": [
    {
      "id": "decision-uuid",
      "relevanceScore": 85,
      "aiSummary": "Esta decisão do TCU...",
      "themes": ["tema1", "tema2"],
      "leiArticles": ["75", "95"]
    }
  ]
}`;
}

// ===========================
// Core Logic
// ===========================

async function evaluateBatch(decisions: DecisionInput[]): Promise<Map<string, { relevanceScore: number; aiSummary: string; themes: string[]; leiArticles: string[] }>> {
  const results = new Map<string, { relevanceScore: number; aiSummary: string; themes: string[]; leiArticles: string[] }>();

  try {
    const prompt = buildFilterPrompt(decisions);
    const result = await queryGeminiText(prompt, {
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      maxOutputTokens: 8192,
      useCache: false,
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    // Parse JSON response (handle markdown code blocks)
    let jsonText = result.response.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText) as {
      evaluations: Array<{
        id: string;
        relevanceScore: number;
        aiSummary: string;
        themes: string[];
        leiArticles: string[];
      }>;
    };

    for (const evaluation of parsed.evaluations) {
      results.set(evaluation.id, {
        relevanceScore: evaluation.relevanceScore,
        aiSummary: evaluation.aiSummary,
        themes: evaluation.themes || [],
        leiArticles: evaluation.leiArticles || [],
      });
    }
  } catch (error) {
    console.error('[Newsletter Filter] Gemini batch evaluation failed:', error);
    // On failure, mark all decisions with score 0 (will use fallback)
  }

  return results;
}

/**
 * Filters decisions by relevance using Gemini AI.
 *
 * @param decisions - All acórdãos/decisions from the month
 * @returns Filtered and scored decisions with AI summaries (10-30 items)
 */
export async function filterByRelevance(decisions: DecisionInput[]): Promise<RelevanceFilterResult> {
  const totalEvaluated = decisions.length;

  if (decisions.length === 0) {
    return { selected: [], totalEvaluated: 0, totalSelected: 0 };
  }

  // If few enough decisions, include all (no need to filter)
  if (decisions.length <= MIN_DECISIONS) {
    console.log(`[Newsletter Filter] Only ${decisions.length} decisions, including all without AI filter`);
    const selected: FilteredDecision[] = decisions.map(d => ({
      id: d.id,
      title: d.title,
      tribunalCode: d.tribunalCode || 'TCU',
      relevanceScore: 70,
      aiSummary: d.summary || d.description || d.ementa || '',
      themes: [],
      leiArticles: [],
    }));
    return { selected, totalEvaluated, totalSelected: selected.length };
  }

  // Process in batches
  const batches: DecisionInput[][] = [];
  for (let i = 0; i < decisions.length; i += BATCH_SIZE) {
    batches.push(decisions.slice(i, i + BATCH_SIZE));
  }

  console.log(`[Newsletter Filter] Evaluating ${decisions.length} decisions in ${batches.length} batches`);

  const allEvaluations = new Map<string, { relevanceScore: number; aiSummary: string; themes: string[]; leiArticles: string[] }>();

  // Process batches sequentially to avoid rate limits
  for (let i = 0; i < batches.length; i++) {
    console.log(`[Newsletter Filter] Processing batch ${i + 1}/${batches.length}`);
    const batchResults = await evaluateBatch(batches[i]);
    for (const [id, eval_] of batchResults) {
      allEvaluations.set(id, eval_);
    }
    // Small delay between batches
    if (i < batches.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Build results, using fallback for decisions that weren't evaluated
  const scored: FilteredDecision[] = decisions.map(d => {
    const evaluation = allEvaluations.get(d.id);
    if (evaluation) {
      return {
        id: d.id,
        title: d.title,
        tribunalCode: d.tribunalCode || 'TCU',
        relevanceScore: evaluation.relevanceScore,
        aiSummary: evaluation.aiSummary,
        themes: evaluation.themes,
        leiArticles: evaluation.leiArticles,
      };
    }
    // Fallback: no AI evaluation available
    return {
      id: d.id,
      title: d.title,
      tribunalCode: d.tribunalCode || 'TCU',
      relevanceScore: 0,
      aiSummary: d.summary || d.description || d.ementa || '',
      themes: [],
      leiArticles: [],
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Select: at least MIN, at most MAX, only those above threshold
  let selected = scored.filter(d => d.relevanceScore >= MIN_SCORE);

  // If too few pass the threshold, take the top MIN_DECISIONS
  if (selected.length < MIN_DECISIONS) {
    selected = scored.slice(0, MIN_DECISIONS);
  }

  // Cap at MAX
  if (selected.length > MAX_DECISIONS) {
    selected = selected.slice(0, MAX_DECISIONS);
  }

  console.log(`[Newsletter Filter] Selected ${selected.length}/${totalEvaluated} decisions (scores: ${selected[0]?.relevanceScore}-${selected[selected.length - 1]?.relevanceScore})`);

  return {
    selected,
    totalEvaluated,
    totalSelected: selected.length,
  };
}
