/**
 * Runner do eval de síntese: para cada query, sintetiza a resposta real e a
 * submete ao LLM-as-judge, agregando faithfulness / citationAccuracy /
 * completeness / overall. Fase 1, passo 5. Análogo ao runner.ts (retrieval),
 * mas medindo o TEXTO gerado, não o ranking.
 */
import type { GoldenQuery } from './types';
import { judgeSynthesis, type SynthesisVerdict } from './judge';
import { synthesizeForQuery } from './answer-adapter';
import type { GenerateAnswerOptions } from '@/lib/rag/answerService';

export interface SynthesisEvalResult {
  id: string;
  query: string;
  empty: boolean;
  sourceCount: number;
  verdict: SynthesisVerdict | null;
  latencyMs: number;
}

export interface SynthesisEvalRun {
  runAt: string;
  answerModel: string;
  judgeModel: string;
  results: SynthesisEvalResult[];
  summary: {
    evaluated: number;
    empty: number;
    faithfulness: number;
    citationAccuracy: number;
    completeness: number;
    overall: number;
  };
}

export async function runSynthesisEval(
  queries: GoldenQuery[],
  opts: { answer?: GenerateAnswerOptions; judgeModel?: string } = {},
): Promise<SynthesisEvalRun> {
  const results: SynthesisEvalResult[] = [];

  for (const q of queries) {
    const t0 = Date.now();
    const sample = await synthesizeForQuery(q.query, opts.answer);
    let verdict: SynthesisVerdict | null = null;
    if (!sample.empty && sample.answer) {
      verdict = await judgeSynthesis({
        query: q.query,
        answer: sample.answer,
        context: sample.context,
        model: opts.judgeModel,
      });
    }
    results.push({
      id: q.id,
      query: q.query,
      empty: sample.empty,
      sourceCount: sample.sourceCount,
      verdict,
      latencyMs: Date.now() - t0,
    });
  }

  const judged = results.filter((r): r is SynthesisEvalResult & { verdict: SynthesisVerdict } => r.verdict !== null);
  const avg = (sel: (v: SynthesisVerdict) => number) =>
    judged.length ? judged.reduce((a, r) => a + sel(r.verdict), 0) / judged.length : 0;

  return {
    runAt: new Date().toISOString(),
    answerModel: opts.answer?.model ?? 'default (task chat)',
    judgeModel: opts.judgeModel ?? 'claude-sonnet-5',
    results,
    summary: {
      evaluated: judged.length,
      empty: results.filter((r) => r.empty).length,
      faithfulness: avg((v) => v.faithfulness),
      citationAccuracy: avg((v) => v.citationAccuracy),
      completeness: avg((v) => v.completeness),
      overall: avg((v) => v.overall),
    },
  };
}
