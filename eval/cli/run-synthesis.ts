/**
 * Roda o eval de SÍNTESE (LLM-as-judge) sobre o golden set e escreve um relatório
 * markdown + json em eval/reports/. Fase 1, passo 6 (a régua nasce ao rodar isto).
 *
 * Uso:
 *   npm run eval:synthesis
 *   npm run eval:synthesis -- --limit 10 --label baseline-gemini
 *   npm run eval:synthesis -- --answer-provider anthropic --answer-model claude-sonnet-5 --label claude
 *
 * Flags:
 *   --limit N            avalia só as N primeiras queries (default: todas)
 *   --citations          usa Claude + Citations API (SINTETIZADOR PADRÃO DE PRODUÇÃO)
 *   --answer-provider    gemini | anthropic (override; ignorado com --citations)
 *   --answer-model       modelo do sintetizador
 *   --judge-model        modelo do juiz (default claude-sonnet-5)
 *   --label TXT          rótulo no nome do arquivo
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runSynthesisEval } from '../synthesis-runner';
import type { GoldenSet } from '../types';
import type { AiProviderName } from '../../lib/ai/types';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const limit = arg('--limit') ? parseInt(arg('--limit')!, 10) : undefined;
  const label = arg('--label') ?? 'synthesis';
  const answerProvider = arg('--answer-provider') as AiProviderName | undefined;
  const answerModel = arg('--answer-model');
  const judgeModel = arg('--judge-model');
  const useCitations = process.argv.includes('--citations');

  const goldenSet: GoldenSet = JSON.parse(
    readFileSync(join(process.cwd(), 'eval/golden-set.json'), 'utf8'),
  );
  const queries = limit ? goldenSet.queries.slice(0, limit) : goldenSet.queries;

  console.log(`[eval-synthesis] ${queries.length} queries`);
  console.log(`[eval-synthesis] answer: ${useCitations ? 'claude+Citations (produção)' : `${answerProvider ?? 'default'}/${answerModel ?? 'default'}`} | judge: ${judgeModel ?? 'claude-sonnet-5'}`);

  const run = await runSynthesisEval(queries, {
    answer: { provider: answerProvider, model: answerModel, useCitations },
    judgeModel,
  });

  const s = run.summary;
  console.log(`[eval-synthesis] avaliadas=${s.evaluated} vazias=${s.empty}`);
  console.log(
    `[eval-synthesis] faithfulness=${(s.faithfulness * 100).toFixed(1)}% citações=${(s.citationAccuracy * 100).toFixed(1)}% completude=${(s.completeness * 100).toFixed(1)}% overall=${(s.overall * 100).toFixed(1)}%`,
  );

  const reportsDir = join(process.cwd(), 'eval/reports');
  mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  writeFileSync(join(reportsDir, `${stamp}_${label}-synthesis.md`), formatReport(run, label), 'utf8');
  writeFileSync(join(reportsDir, `${stamp}_${label}-synthesis.json`), JSON.stringify(run, null, 2), 'utf8');
  console.log(`[eval-synthesis] relatório: eval/reports/${stamp}_${label}-synthesis.md`);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatReport(run: import('../synthesis-runner').SynthesisEvalRun, label: string): string {
  const s = run.summary;
  const lines: string[] = [];
  lines.push(`# Eval de Síntese — ${label}`);
  lines.push('');
  lines.push(`- **runAt:** ${run.runAt}`);
  lines.push(`- **sintetizador:** ${run.answerModel} · **juiz:** ${run.judgeModel}`);
  lines.push(`- **avaliadas:** ${s.evaluated} · **vazias (sem retrieval):** ${s.empty}`);
  lines.push('');
  lines.push('## Métricas agregadas');
  lines.push('');
  lines.push('| Dimensão | Média |');
  lines.push('|---|---|');
  lines.push(`| Faithfulness (anti-alucinação) | ${pct(s.faithfulness)} |`);
  lines.push(`| Citation accuracy | ${pct(s.citationAccuracy)} |`);
  lines.push(`| Completeness | ${pct(s.completeness)} |`);
  lines.push(`| **Overall** (fidelidade pesa 2×) | **${pct(s.overall)}** |`);
  lines.push('');
  lines.push('## Piores casos (menor overall)');
  lines.push('');
  const worst = run.results
    .filter((r) => r.verdict)
    .sort((a, b) => a.verdict!.overall - b.verdict!.overall)
    .slice(0, 10);
  for (const r of worst) {
    const v = r.verdict!;
    lines.push(`### ${r.id} — overall ${pct(v.overall)}`);
    lines.push(`_${r.query}_`);
    lines.push('');
    lines.push(`faith ${pct(v.faithfulness)} · cit ${pct(v.citationAccuracy)} · compl ${pct(v.completeness)}`);
    if (v.issues.length) lines.push(`- issues: ${v.issues.join('; ')}`);
    if (v.rationale) lines.push(`- ${v.rationale}`);
    lines.push('');
  }
  return lines.join('\n');
}

main().catch((err) => {
  console.error('[eval-synthesis] FALHOU:', err);
  process.exit(1);
});
