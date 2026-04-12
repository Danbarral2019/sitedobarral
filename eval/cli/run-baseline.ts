/**
 * Roda o eval contra o golden set atual usando o `baselineSearch` adapter
 * e escreve um relatório markdown em eval/reports/.
 *
 * Uso:
 *   tsx eval/cli/run-baseline.ts [--label "minha-rodada"]
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { baselineSearch, rerankSearch, hydeSearch } from '../search-adapter'
import { runEval } from '../runner'
import { formatReport } from '../report'
import type { GoldenSet } from '../types'

async function main() {
  const args = process.argv.slice(2)
  const labelIdx = args.indexOf('--label')
  const label = labelIdx >= 0 ? args[labelIdx + 1] : 'baseline'
  const useRerank = args.includes('--rerank')
  const useCohere = args.includes('--cohere')
  const useHyde = args.includes('--hyde')

  // --cohere seta RERANK_PROVIDER para o reranker usar Cohere em vez de Gemini
  if (useCohere) process.env.RERANK_PROVIDER = 'cohere'

  const goldenSetPath = join(process.cwd(), 'eval/golden-set.json')
  const raw = readFileSync(goldenSetPath, 'utf8')
  const goldenSet: GoldenSet = JSON.parse(raw)

  const searchFn = useHyde ? hydeSearch : (useRerank || useCohere) ? rerankSearch : baselineSearch
  const mode = useHyde ? 'hybrid + HyDE + rerank' : useCohere ? 'hybrid + rerank (Cohere 3.5)' : useRerank ? 'hybrid + rerank (Gemini)' : 'hybrid baseline'
  console.log(`[eval] Loaded ${goldenSet.queries.length} queries`)
  console.log(`[eval] Search mode: ${mode}`)
  console.log(`[eval] Running search adapter against each annotated query...`)

  const run = await runEval(goldenSet, searchFn)

  console.log(`[eval] ${run.summary.queriesAnnotated} evaluated, ${run.summary.queriesSkipped} skipped (not annotated)`)
  console.log(`[eval] recall@5=${(run.summary.recallAt5_avg * 100).toFixed(1)}% mrr=${run.summary.mrr.toFixed(3)} ndcg@10=${run.summary.ndcgAt10_avg.toFixed(3)}`)

  const reportsDir = join(process.cwd(), 'eval/reports')
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `${stamp}_${label}.md`
  const fullPath = join(reportsDir, filename)
  writeFileSync(fullPath, formatReport(run, label), 'utf8')

  console.log(`[eval] Report written to eval/reports/${filename}`)
}

main().catch((err) => {
  console.error('[eval] FAILED:', err)
  process.exit(1)
})
