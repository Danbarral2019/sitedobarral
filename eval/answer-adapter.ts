/**
 * Ponte entre uma query do golden set e a resposta sintetizada real do sistema,
 * via `generateAnswer` (mesma pipeline da produção). Fase 1, passo 5.
 * `context` é o material fornecido ao modelo (synthesisPrompt), usado pelo juiz.
 */
import { generateAnswer, type GenerateAnswerOptions } from '@/lib/rag/answerService';

export interface SynthesisSample {
  answer: string;
  context: string;
  empty: boolean;
  sourceCount: number;
  maxSimilarity: number;
}

export async function synthesizeForQuery(
  query: string,
  opts?: GenerateAnswerOptions,
): Promise<SynthesisSample> {
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
