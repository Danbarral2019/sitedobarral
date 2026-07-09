/**
 * BIA-1 — Consolida os 4 relatórios de síntese do A/B (baseline vs novo prompt,
 * queries 1-12 + 13-30) num único resultado N=30 e faz análise PAREADA por query.
 * Só lê JSONs — nenhum custo de LLM.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'eval/reports')
const load = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'))

const baseline = [
  ...load('2026-07-09T17-51-34_bia1-baseline-n12-synthesis.json').results,
  ...load('2026-07-09T18-37-44_bia1-baseline-13a30-synthesis.json').results,
]
const novo = [
  ...load('2026-07-09T18-05-38_bia1-novo-n12-synthesis.json').results,
  ...load('2026-07-09T18-53-59_bia1-novo-13a30-synthesis.json').results,
]

const byId = (arr: any[]) => new Map(arr.filter((r) => r.verdict).map((r) => [r.id, r.verdict]))
const B = byId(baseline)
const N = byId(novo)

const dims = ['faithfulness', 'citationAccuracy', 'completeness', 'overall'] as const
const mean = (m: Map<string, any>, k: string) =>
  [...m.values()].reduce((a, v) => a + v[k], 0) / m.size

console.log(`Queries avaliadas: baseline=${B.size} · novo=${N.size}`)
console.log('')
console.log('Dimensão'.padEnd(20), 'Baseline'.padEnd(10), 'Novo'.padEnd(10), 'Δ (pp)')
for (const d of dims) {
  const b = mean(B, d) * 100
  const n = mean(N, d) * 100
  const delta = n - b
  console.log(
    d.padEnd(20),
    (b.toFixed(1) + '%').padEnd(10),
    (n.toFixed(1) + '%').padEnd(10),
    (delta >= 0 ? '+' : '') + delta.toFixed(1),
  )
}

console.log('')
console.log('=== Análise PAREADA por query (novo − baseline) ===')
for (const d of dims) {
  let win = 0, loss = 0, tie = 0
  const deltas: number[] = []
  for (const [id, bv] of B) {
    const nv = N.get(id)
    if (!nv) continue
    const dd = nv[d] - bv[d]
    deltas.push(dd)
    if (dd > 0.001) win++
    else if (dd < -0.001) loss++
    else tie++
  }
  const meanD = (deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100
  console.log(
    `${d.padEnd(18)} melhorou ${win} · piorou ${loss} · empatou ${tie}  (Δ médio pareado ${meanD >= 0 ? '+' : ''}${meanD.toFixed(1)}pp)`,
  )
}

// Faithfulness: queries onde piorou (para vigiar regressões)
console.log('')
console.log('=== Faithfulness: queries que PIORARAM (vigiar) ===')
for (const [id, bv] of B) {
  const nv = N.get(id)
  if (nv && nv.faithfulness < bv.faithfulness - 0.001) {
    console.log(`  ${id}: ${(bv.faithfulness * 100).toFixed(0)}% → ${(nv.faithfulness * 100).toFixed(0)}%`)
  }
}
