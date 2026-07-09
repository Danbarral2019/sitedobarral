/**
 * BIA-4b — Diagnóstico das queries super-anotadas do golden set.
 *
 * recall@5 fica capado por construção quando |relevant| > 5: mesmo um ranking
 * perfeito não alcança 1.0. Este script lista essas queries para embasar a
 * decisão de higiene (enxugar `relevant` aos centrais OU tratar
 * `highlyRelevant` como alvo primário). NÃO altera o golden — só reporta.
 *
 * Uso: npx tsx eval/scripts/analyze-overannotated.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GoldenSet } from '../types'

const goldenSet: GoldenSet = JSON.parse(
  readFileSync(join(process.cwd(), 'eval/golden-set.json'), 'utf8')
)

const annotated = goldenSet.queries.filter((q) => q.annotations.relevant.length > 0)
const over5 = annotated.filter((q) => q.annotations.relevant.length > 5)

// recall@5 máximo teórico por query = min(5, |relevant|) / |relevant|
const cappedCeiling = (n: number) => Math.min(5, n) / n

console.log(`Total queries:            ${goldenSet.queries.length}`)
console.log(`Anotadas (relevant>0):    ${annotated.length}`)
console.log(`Super-anotadas (>5 rel):  ${over5.length}`)
console.log('')

console.log('Distribuição de |relevant| entre anotadas:')
const dist = new Map<number, number>()
for (const q of annotated) {
  const n = q.annotations.relevant.length
  dist.set(n, (dist.get(n) ?? 0) + 1)
}
;[...dist.keys()].sort((a, b) => a - b).forEach((k) => {
  const teto = cappedCeiling(k)
  const flag = k > 5 ? `  ← recall@5 capado em ${(teto * 100).toFixed(0)}%` : ''
  console.log(`  ${String(k).padStart(2)} relevantes: ${dist.get(k)} queries${flag}`)
})
console.log('')

// Impacto agregado: quanto o teto médio de recall@5 é puxado para baixo pelas super-anotadas
const meanCeilingAll =
  annotated.reduce((s, q) => s + cappedCeiling(q.annotations.relevant.length), 0) / annotated.length
console.log(`Teto médio de recall@5 (todas anotadas): ${(meanCeilingAll * 100).toFixed(1)}%`)
console.log(`→ mesmo um retrieval PERFEITO não passa disso no recall@5 atual.`)
console.log('')

console.log('Queries super-anotadas (>5 relevantes):')
console.log('id'.padEnd(10), 'diff'.padEnd(7), 'rel'.padEnd(4), 'hi'.padEnd(4), 'teto@5'.padEnd(7), 'query')
for (const q of over5.sort((a, b) => b.annotations.relevant.length - a.annotations.relevant.length)) {
  const rel = q.annotations.relevant.length
  const hi = q.annotations.highlyRelevant.length
  const teto = (cappedCeiling(rel) * 100).toFixed(0) + '%'
  console.log(
    q.id.padEnd(10),
    q.difficulty.padEnd(7),
    String(rel).padEnd(4),
    String(hi).padEnd(4),
    teto.padEnd(7),
    q.query.slice(0, 60)
  )
}
console.log('')
const withoutHi = over5.filter((q) => q.annotations.highlyRelevant.length === 0)
console.log(`Super-anotadas SEM highlyRelevant marcado: ${withoutHi.length} de ${over5.length}`)
if (withoutHi.length > 0) {
  console.log('  (essas não teriam alvo primário se migrássemos para "highlyRelevant como alvo")')
  withoutHi.forEach((q) => console.log(`   - ${q.id}: ${q.query.slice(0, 55)}`))
}
