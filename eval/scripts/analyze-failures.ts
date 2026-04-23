/**
 * Analisa as queries com recall@5 ≤ 20% de um EvalRun, enriquece com
 * sinais do DB e classifica em buckets (C/D/A/A'/B) seguindo o spec
 * docs/superpowers/specs/2026-04-23-fase0-failure-analysis-design.md.
 *
 * Uso:
 *   tsx eval/scripts/analyze-failures.ts --from eval/reports/<stamp>_<label>.json
 *   tsx eval/scripts/analyze-failures.ts            # auto-detecta o JSON mais recente
 *   tsx eval/scripts/analyze-failures.ts --threshold 0.2
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { EvalRun, GoldenQuery, GoldenSet, QueryEvalResult } from '../types'
import { extractKeyTerms, matchKeyTermsInText } from './failure-analysis/key-terms'
import { classifyBucket } from './failure-analysis/bucket-heuristic'
import { formatCSV, formatMarkdown } from './failure-analysis/report-format'
import {
  fetchDocSignal,
  fetchDocContents,
  fetchDocTitles,
  findFirstRelevantPositionInTop100,
} from './failure-analysis/db-signals'
import type { BucketedRow, FailureAnalysisReport, Signals } from './failure-analysis/types'

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const from = get('--from')
  const thresholdRaw = get('--threshold')
  const threshold = thresholdRaw !== undefined ? parseFloat(thresholdRaw) : 0.2
  const force = args.includes('--force')
  return { from, threshold, force }
}

function findLatestJsonRun(reportsDir: string): string {
  const files = readdirSync(reportsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
  if (files.length === 0) throw new Error('Nenhum JSON em eval/reports/. Rode `npm run eval:run` antes.')
  return join(reportsDir, files[0])
}

async function buildSignals(
  result: QueryEvalResult,
  goldenQuery: GoldenQuery
): Promise<Signals> {
  const relevantIds = goldenQuery.annotations.relevant
  const highlyRelevantIds = goldenQuery.annotations.highlyRelevant
  const keyTerms = extractKeyTerms(goldenQuery.query)

  // Enriquecimento paralelo
  const top5Ids = result.predicted.slice(0, 5)
  const [docSignals, expectedContents, top5Titles, top5Contents] = await Promise.all([
    Promise.all(relevantIds.map((id) => fetchDocSignal(id))),
    fetchDocContents(relevantIds),
    fetchDocTitles(top5Ids),
    fetchDocContents(top5Ids),
  ])

  const expectedConcat = relevantIds.map((id) => expectedContents[id] ?? '').join('\n\n')
  const top5Concat = top5Ids.map((id) => top5Contents[id] ?? '').join('\n\n')

  const needsTop100 =
    result.reciprocalRank === 0 && relevantIds.length > 0
  const docPositionInTop100 = needsTop100
    ? await findFirstRelevantPositionInTop100(goldenQuery.query, relevantIds)
    : null

  return {
    id: result.id,
    query: result.query,
    difficulty: result.difficulty,
    recallAt5: result.recallAt5,
    reciprocalRank: result.reciprocalRank,
    predictedTop20: result.predicted,
    relevantIds,
    highlyRelevantIds,
    relevantDocs: docSignals,
    docPositionInTop100,
    keyTerms,
    keyTermsInExpectedDoc: matchKeyTermsInText(keyTerms, expectedConcat),
    keyTermsInTop5Docs: matchKeyTermsInText(keyTerms, top5Concat),
    top5Titles: top5Ids.map((id) => top5Titles[id] ?? '—'),
  }
}

async function main() {
  const { from, threshold, force } = parseArgs()
  const reportsDir = join(process.cwd(), 'eval/reports')
  const jsonPath = from ?? findLatestJsonRun(reportsDir)

  console.log(`[fa] Lendo run: ${jsonPath}`)
  const run: EvalRun = JSON.parse(readFileSync(jsonPath, 'utf8'))

  const goldenPath = join(process.cwd(), 'eval/golden-set.json')
  const golden: GoldenSet = JSON.parse(readFileSync(goldenPath, 'utf8'))
  const goldenById = new Map(golden.queries.map((q) => [q.id, q]))

  const failed = run.perQuery.filter((r) => r.recallAt5 <= threshold)
  console.log(`[fa] Encontradas ${failed.length} queries com recall@5 ≤ ${threshold}`)

  const rows: BucketedRow[] = []
  for (let i = 0; i < failed.length; i++) {
    const result = failed[i]
    const gq = goldenById.get(result.id)
    if (!gq) {
      console.warn(`[fa] golden query ${result.id} não encontrada, pulando`)
      continue
    }
    console.log(`[fa] ${i + 1}/${failed.length} — ${result.id}`)
    const signals = await buildSignals(result, gq)
    const { bucket, reason } = classifyBucket(signals)
    rows.push({ ...signals, bucketAuto: bucket, bucketReason: reason, bucketManual: '' })
  }

  const stamp = new Date().toISOString().slice(0, 10)

  const report: FailureAnalysisReport = {
    sourceRunPath: jsonPath.replace(/\\/g, '/'),
    scopeDescription: `${rows.length} queries com recall@5 ≤ ${(threshold * 100).toFixed(0)}%`,
    generatedAt: stamp,
    rows,
  }

  const mdPath = join(reportsDir, `failure-analysis-${stamp}.md`)
  const csvPath = join(reportsDir, `failure-analysis-${stamp}.csv`)

  if (!force) {
    const existing: string[] = []
    if (existsSync(mdPath)) existing.push(mdPath)
    if (existsSync(csvPath)) existing.push(csvPath)
    if (existing.length > 0) {
      throw new Error(
        `Arquivos já existem (usa --force para sobrescrever):\n  ${existing.join('\n  ')}`
      )
    }
  }

  writeFileSync(mdPath, formatMarkdown(report), 'utf8')
  writeFileSync(csvPath, formatCSV(rows), 'utf8')

  console.log(`[fa] MD:  ${mdPath}`)
  console.log(`[fa] CSV: ${csvPath}`)
  console.log('[fa] Distribuição auto:')
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.bucketAuto] = (counts[r.bucketAuto] ?? 0) + 1
  for (const [b, n] of Object.entries(counts).sort()) console.log(`[fa]   ${b}: ${n}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[fa] FAILED:', err)
    process.exit(1)
  })
