import type { BucketAuto, BucketedRow, FailureAnalysisReport } from './types'

const CSV_COLUMNS = [
  'id',
  'query',
  'difficulty',
  'recall@5',
  'mrr',
  'n_relevant',
  'n_relevant_with_chunks',
  'doc_position_top100',
  'key_terms',
  'key_terms_in_expected',
  'key_terms_in_top5',
  'top5_titles',
  'bucket_auto',
  'bucket_reason',
  'bucket_manual',
] as const

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (/["\r\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function serializeTermMap(m: Record<string, boolean>): string {
  return Object.entries(m).map(([k, v]) => `${k}=${v ? 'Y' : 'N'}`).join(';')
}

export function formatCSV(rows: BucketedRow[]): string {
  const lines: string[] = [CSV_COLUMNS.join(',')]
  for (const r of rows) {
    const nRelevantWithChunks = r.relevantDocs.filter((d) => d.chunkCount > 0).length
    const values = [
      r.id,
      r.query,
      r.difficulty,
      r.recallAt5.toFixed(3),
      r.reciprocalRank.toFixed(3),
      r.relevantDocs.length,
      nRelevantWithChunks,
      r.docPositionInTop100 ?? '',
      r.keyTerms.join(';'),
      serializeTermMap(r.keyTermsInExpectedDoc),
      serializeTermMap(r.keyTermsInTop5Docs),
      r.top5Titles.join(' || '),
      r.bucketAuto,
      r.bucketReason,
      r.bucketManual,
    ]
    lines.push(values.map(csvEscape).join(','))
  }
  return lines.join('\n')
}

const ALL_BUCKETS: BucketAuto[] = ['A', "A'", 'B', 'C', 'C-parcial', 'D', 'D+']

const PHASE_HINT: Record<BucketAuto, string> = {
  A: 'Fase 1 (HyDE) + Fase 3 (embedding)',
  "A'": 'Fase 4 (tuning FTS)',
  B: 'Fase 3 (embedding) ou Fase 5 (chunking)',
  C: 'Fix scraper / re-rodar migrate-to-embeddings',
  'C-parcial': 'Fix scraper / re-rodar migrate-to-embeddings (parcial)',
  D: 'Fase 2 (rerank) ou Fase 4 (hybrid tuning)',
  'D+': 'Fase 2 (rerank) — alta confiança',
}

export function formatMarkdown(report: FailureAnalysisReport): string {
  const counts: Record<BucketAuto, number> = {
    A: 0, "A'": 0, B: 0, C: 0, 'C-parcial': 0, D: 0, 'D+': 0,
  }
  for (const r of report.rows) counts[r.bucketAuto]++

  const lines: string[] = []
  lines.push(`# Failure Analysis — ${report.generatedAt}`)
  lines.push('')
  lines.push(`- **Run fonte:** ${report.sourceRunPath}`)
  lines.push(`- **Escopo:** ${report.scopeDescription}`)
  lines.push(`- **Metodologia:** \`eval/scripts/analyze-failures.ts\` (ver "Como reproduzir")`)
  lines.push('')

  lines.push('## Distribuição por bucket')
  lines.push('')
  lines.push('| Bucket | Auto | Após review | Fase sugerida |')
  lines.push('|---|---|---|---|')
  for (const b of ALL_BUCKETS) {
    lines.push(`| ${b} | ${counts[b]} | _(preencher)_ | ${PHASE_HINT[b]} |`)
  }
  lines.push(`| E. Anotação suspeita | — | _(preencher)_ | Fase 6 |`)
  lines.push('')

  lines.push('## Recomendação de ordem revisada das fases')
  lines.push('')
  lines.push('_(Preencher após revisão manual — 3-5 bullets concretos baseados na distribuição final.)_')
  lines.push('')

  lines.push('## Drill-down por query')
  lines.push('')
  for (const r of report.rows) {
    lines.push(`### ${r.id} — bucket ${r.bucketAuto}`)
    lines.push(`- **Query:** ${r.query}`)
    lines.push(`- **Difficulty:** ${r.difficulty}`)
    lines.push(`- **recall@5 / MRR:** ${(r.recallAt5 * 100).toFixed(1)}% / ${r.reciprocalRank.toFixed(3)}`)
    lines.push(`- **Doc(s) esperado(s):** ${r.relevantDocs.map((d) => `${d.title ?? '—'} (${d.id.slice(0, 8)}, chunks=${d.chunkCount})`).join('; ')}`)
    lines.push(`- **Key terms:** ${r.keyTerms.length > 0 ? r.keyTerms.join(', ') : '—'}`)
    if (r.keyTerms.length > 0) {
      lines.push(`- **Em doc esperado?** ${serializeTermMap(r.keyTermsInExpectedDoc)}`)
      lines.push(`- **Em top-5?** ${serializeTermMap(r.keyTermsInTop5Docs)}`)
    }
    lines.push(`- **Posição top-100:** ${r.docPositionInTop100 ?? '—'}`)
    lines.push(`- **Top-5 retornados:** ${r.top5Titles.join(' || ') || '—'}`)
    lines.push(`- **Por que ${r.bucketAuto}:** ${r.bucketReason}`)
    lines.push(`- **Bucket review:** _(preencher — confirmado ou reclassificar)_`)
    lines.push('')
  }

  lines.push('## Como reproduzir')
  lines.push('')
  lines.push('```bash')
  lines.push('npm run eval:run -- --label diag-fase0')
  lines.push('npx tsx eval/scripts/analyze-failures.ts --from eval/reports/<stamp>_diag-fase0.json')
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}
