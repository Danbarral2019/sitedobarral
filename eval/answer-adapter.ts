/**
 * Ponte entre uma query do golden set e a resposta sintetizada real do sistema.
 * Dois caminhos, espelhando a produção:
 *  - default: `generateAnswer` (síntese com contexto no prompt — caminho de fallback Gemini).
 *  - `useCitations`: `generateAnswerWithCitations` (Claude Sonnet 5 + Citations API —
 *    o SINTETIZADOR PADRÃO DE PRODUÇÃO). O material dado ao juiz são os
 *    `citationDocuments` (as fontes que o Claude realmente viu).
 * `context` é o material fornecido ao modelo, usado pelo juiz.
 */
import {
  generateAnswer,
  generateAnswerWithCitations,
  type GenerateAnswerOptions,
} from '@/lib/rag/answerService';

export interface SynthesizeOptions extends GenerateAnswerOptions {
  /** Usa o caminho Claude + Citations API (padrão de produção). */
  useCitations?: boolean;
}

export interface SynthesisSample {
  answer: string;
  context: string;
  empty: boolean;
  sourceCount: number;
  maxSimilarity: number;
}

export async function synthesizeForQuery(
  query: string,
  opts?: SynthesizeOptions,
): Promise<SynthesisSample> {
  if (opts?.useCitations) {
    const { answer, context } = await generateAnswerWithCitations(
      { query, filters: {}, maxResults: 5, useCache: false },
      { model: opts.model },
    );
    // O juiz recebe como "material" as fontes passadas ao Claude via Citations API.
    const material = context.citationDocuments
      .map((d) => `[${d.title}]\n${d.text}`)
      .join('\n\n');
    return {
      answer,
      context: material,
      empty: context.empty || context.citationDocuments.length === 0,
      sourceCount: context.citationDocuments.length,
      maxSimilarity: context.maxSimilarity,
    };
  }

  const { answer, context } = await generateAnswer(
    { query, filters: {}, maxResults: 5, useCache: false },
    opts,
  );
  return {
    answer,
    context: context.synthesisPrompt,
    empty: context.empty,
    sourceCount: context.formattedResults.length,
    maxSimilarity: context.maxSimilarity,
  };
}
