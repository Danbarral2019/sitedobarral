import type { EvalRun } from './types'

/**
 * Formata um EvalRun como markdown legível, ideal para commitar em eval/reports/.
 */
export function formatReport(run: EvalRun, label: string): string {
  const s = run.summary
  const pct = (n: number) => (n * 100).toFixed(1) + '%'
  const num = (n: number) => n.toFixed(3)

  const lines: string[] = []
  lines.push(`# Eval Run — ${label}`)
  lines.push('')
  lines.push(`- **Run at:** ${run.runAt}`)
  lines.push(`- **Git SHA:** \`${run.gitSha}\``)
  lines.push(`- **Queries:** ${s.queriesAnnotated} annotated / ${s.queriesTotal} total (${s.queriesSkipped} skipped)`)
  lines.push('')
  lines.push('## Aggregate metrics')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|---|---|')
  lines.push(`| Recall@5 (avg) | ${pct(s.recallAt5_avg)} |`)
  lines.push(`| Recall@10 (avg) | ${pct(s.recallAt10_avg)} |`)
  lines.push(`| Recall@5 primário — vs highlyRelevant (avg) | ${pct(s.recallAt5Primary_avg)} (${s.primaryTargetQueries} queries) |`)
  lines.push(`| MRR | ${num(s.mrr)} |`)
  lines.push(`| nDCG@10 (avg) | ${num(s.ndcgAt10_avg)} |`)
  lines.push('')
  lines.push('## By difficulty')
  lines.push('')
  lines.push('| Difficulty | N | Recall@5 | Recall@10 | MRR | nDCG@10 |')
  lines.push('|---|---|---|---|---|---|')
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const b = s.byDifficulty[d]
    lines.push(`| ${d} | ${b.count} | ${pct(b.recallAt5_avg)} | ${pct(b.recallAt10_avg)} | ${num(b.mrr)} | ${num(b.ndcgAt10_avg)} |`)
  }
  lines.push('')
  lines.push('## Per-query results')
  lines.push('')
  lines.push('| ID | Query | Difficulty | Recall@5 | Recall@10 | Recall@5 prim. | RR | nDCG@10 | Latency (ms) |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of run.perQuery) {
    const ndcg = r.ndcgAt10 === null ? '—' : num(r.ndcgAt10)
    const primary = r.recallAt5Primary === null ? '—' : pct(r.recallAt5Primary)
    const queryEsc = r.query.replace(/\|/g, '\\|')
    lines.push(`| \`${r.id}\` | ${queryEsc} | ${r.difficulty} | ${pct(r.recallAt5)} | ${pct(r.recallAt10)} | ${primary} | ${num(r.reciprocalRank)} | ${ndcg} | ${r.latencyMs} |`)
  }
  lines.push('')
  return lines.join('\n')
}
