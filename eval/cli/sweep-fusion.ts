/**
 * BIA-3 — Sweep de tuning da fusão FTS×vetor (alpha × RRF_K).
 *
 * Varre combinações de `alpha` (peso vetor vs FTS) e `rrfK` (suavização do
 * Reciprocal Rank Fusion) rodando o golden set inteiro por combinação e
 * reportando recall@5, recall@10, MRR e nDCG@10 de cada uma.
 *
 * O retrieval (vetor + FTS) é DETERMINÍSTICO e independe de alpha/rrfK — só a
 * fusão RRF muda. `useCache: true` faz o 1º config popular o cache do ramo
 * vetorial; os configs seguintes reaproveitam (mesma query, mesmas
 * vectorOptions), então o custo real ≈ 1 retrieval completo + N fusões.
 * Sem custo de LLM além dos embeddings de query (baratos).
 *
 * Uso:
 *   npm run eval:sweep
 *   npm run eval:sweep -- --alphas 0.4,0.5,0.6,0.7,0.8 --rrfks 30,60,100
 *   npm run eval:sweep -- --label meu-sweep
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { hybridSearch, DEFAULT_RRF_K } from '@/lib/embeddings/hybrid-search'
import { runEval } from '../runner'
import type { GoldenSet, SearchFn } from '../types'

const BASELINE_ALPHA = 0.6

interface SweepRow {
  alpha: number
  rrfK: number
  recallAt5: number
  recallAt10: number
  mrr: number
  ndcgAt10: number
  isBaseline: boolean
}

/** Adapter de busca híbrida com alpha/rrfK fixos e dedup por documentId. */
function makeAdapter(alpha: number, rrfK: number): SearchFn {
  return async (query: string) => {
    const start = Date.now()
    const response = await hybridSearch({ query, limit: 20, alpha, rrfK, useCache: true })
    const seen = new Set<string>()
    const ids: string[] = []
    for (const r of response.results) {
      if (!seen.has(r.documentId)) {
        seen.add(r.documentId)
        ids.push(r.documentId)
      }
    }
    return { documentIds: ids, latencyMs: Date.now() - start }
  }
}

function parseListFlag(args: string[], flag: string, fallback: number[]): number[] {
  const i = args.indexOf(flag)
  if (i < 0) return fallback
  return args[i + 1]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))
}

async function main() {
  const args = process.argv.slice(2)
  const labelIdx = args.indexOf('--label')
  const label = labelIdx >= 0 ? args[labelIdx + 1] : 'sweep-fusion'

  const alphas = parseListFlag(args, '--alphas', [0.4, 0.5, 0.6, 0.7, 0.8])
  const rrfks = parseListFlag(args, '--rrfks', [30, DEFAULT_RRF_K, 100])

  const goldenSetPath = join(process.cwd(), 'eval/golden-set.json')
  const goldenSet: GoldenSet = JSON.parse(readFileSync(goldenSetPath, 'utf8'))

  const combos = alphas.length * rrfks.length
  console.log(`[sweep] ${goldenSet.queries.length} queries · grid ${alphas.length}×${rrfks.length} = ${combos} combinações`)
  console.log(`[sweep] alphas=[${alphas.join(', ')}]  rrfKs=[${rrfks.join(', ')}]`)

  const rows: SweepRow[] = []
  let n = 0
  for (const alpha of alphas) {
    for (const rrfK of rrfks) {
      n++
      const run = await runEval(goldenSet, makeAdapter(alpha, rrfK))
      const s = run.summary
      const row: SweepRow = {
        alpha,
        rrfK,
        recallAt5: s.recallAt5_avg,
        recallAt10: s.recallAt10_avg,
        mrr: s.mrr,
        ndcgAt10: s.ndcgAt10_avg,
        isBaseline: alpha === BASELINE_ALPHA && rrfK === DEFAULT_RRF_K,
      }
      rows.push(row)
      console.log(
        `[sweep] ${n}/${combos}  alpha=${alpha} rrfK=${rrfK}  ` +
          `r@5=${(row.recallAt5 * 100).toFixed(1)}%  r@10=${(row.recallAt10 * 100).toFixed(1)}%  ` +
          `mrr=${row.mrr.toFixed(3)}  ndcg=${row.ndcgAt10.toFixed(3)}` +
          (row.isBaseline ? '  ← baseline' : '')
      )
    }
  }

  const baseline = rows.find((r) => r.isBaseline)
  const baseMrr = baseline?.mrr ?? 0

  // Ordena por recall@5 desc, desempate por recall@10 desc, depois MRR desc.
  const ranked = [...rows].sort(
    (a, b) => b.recallAt5 - a.recallAt5 || b.recallAt10 - a.recallAt10 || b.mrr - a.mrr
  )

  // Melhor candidato SEM regressão de MRR vs baseline (gate do BIA-3).
  const best = ranked.find((r) => r.mrr >= baseMrr - 1e-9) ?? ranked[0]

  console.log('')
  console.log('[sweep] === TOP 5 por recall@5 (desempate recall@10, MRR) ===')
  ranked.slice(0, 5).forEach((r, i) => {
    console.log(
      `  ${i + 1}. alpha=${r.alpha} rrfK=${r.rrfK}  r@5=${(r.recallAt5 * 100).toFixed(1)}%  ` +
        `r@10=${(r.recallAt10 * 100).toFixed(1)}%  mrr=${r.mrr.toFixed(3)}` +
        (r.isBaseline ? '  ← baseline' : '')
    )
  })
  console.log('')
  if (baseline) {
    console.log(
      `[sweep] baseline (alpha=${BASELINE_ALPHA}, rrfK=${DEFAULT_RRF_K}): ` +
        `r@5=${(baseline.recallAt5 * 100).toFixed(1)}%  r@10=${(baseline.recallAt10 * 100).toFixed(1)}%  mrr=${baseline.mrr.toFixed(3)}`
    )
  }
  console.log(
    `[sweep] MELHOR sem regressão de MRR: alpha=${best.alpha} rrfK=${best.rrfK}  ` +
      `r@5=${(best.recallAt5 * 100).toFixed(1)}%  r@10=${(best.recallAt10 * 100).toFixed(1)}%  mrr=${best.mrr.toFixed(3)}`
  )
  if (baseline) {
    const dR5 = (best.recallAt5 - baseline.recallAt5) * 100
    const dR10 = (best.recallAt10 - baseline.recallAt10) * 100
    console.log(`[sweep] Δ vs baseline: recall@5 ${dR5 >= 0 ? '+' : ''}${dR5.toFixed(1)}pp · recall@10 ${dR10 >= 0 ? '+' : ''}${dR10.toFixed(1)}pp`)
  }

  // Relatório markdown (heatmap por combinação)
  const pct = (x: number) => (x * 100).toFixed(1) + '%'
  const num = (x: number) => x.toFixed(3)
  const lines: string[] = []
  lines.push(`# Fusion Sweep — ${label}`)
  lines.push('')
  lines.push(`- **Run at:** ${new Date().toISOString()}`)
  lines.push(`- **Queries avaliadas:** ${runSummaryQueries(goldenSet)}`)
  lines.push(`- **Grid:** alpha ∈ {${alphas.join(', ')}} × rrfK ∈ {${rrfks.join(', ')}}`)
  lines.push('')
  lines.push('## Resultados por combinação (ordenado por recall@5)')
  lines.push('')
  lines.push('| alpha | rrfK | Recall@5 | Recall@10 | MRR | nDCG@10 | |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const r of ranked) {
    const flag = r.isBaseline ? 'baseline' : r === best ? '★ melhor' : ''
    lines.push(`| ${r.alpha} | ${r.rrfK} | ${pct(r.recallAt5)} | ${pct(r.recallAt10)} | ${num(r.mrr)} | ${num(r.ndcgAt10)} | ${flag} |`)
  }
  lines.push('')
  if (baseline) {
    lines.push(`**Baseline** (alpha ${BASELINE_ALPHA}, rrfK ${DEFAULT_RRF_K}): recall@5 ${pct(baseline.recallAt5)} · recall@10 ${pct(baseline.recallAt10)} · MRR ${num(baseline.mrr)}`)
    lines.push('')
    lines.push(`**Melhor sem regressão de MRR:** alpha ${best.alpha}, rrfK ${best.rrfK} → recall@5 ${pct(best.recallAt5)} · recall@10 ${pct(best.recallAt10)} · MRR ${num(best.mrr)}`)
    lines.push('')
    lines.push('> **Gate BIA-3:** promover só se recall@5 subir (mesmo 1-2pp) SEM regredir MRR/nDCG. Caso contrário, manter o default e registrar que a fusão está no ótimo.')
  }
  lines.push('')

  const reportsDir = join(process.cwd(), 'eval/reports')
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const fullPath = join(reportsDir, `${stamp}_${label}.md`)
  writeFileSync(fullPath, lines.join('\n'), 'utf8')
  console.log(`[sweep] Relatório escrito em eval/reports/${stamp}_${label}.md`)
}

/** Conta quantas queries do golden estão anotadas (relevant não vazio). */
function runSummaryQueries(goldenSet: GoldenSet): string {
  const annotated = goldenSet.queries.filter((q) => q.annotations.relevant.length > 0).length
  return `${annotated} anotadas / ${goldenSet.queries.length} total`
}

main().catch((err) => {
  console.error('[sweep] FAILED:', err)
  process.exit(1)
})
