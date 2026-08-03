/**
 * A/B: qual o efeito, no retrieval, dos 13.395 acórdãos da campanha do TCU
 * (`category = 'acordao-grafo'`) ocupando ~34% do índice vetorial?
 *
 * HIPÓTESE (2026-08-03): todos esses documentos são `isPublic = false`, mas
 * `lib/embeddings/` não filtra visibilidade — eles concorreriam por vaga no
 * top-K como qualquer outro chunk, e a queda de recall entre o baseline de
 * 09/07 (65,2%) e 30/07 (62,8%) viria dessa diluição.
 *
 * ❌ RESULTADO = HIPÓTESE REFUTADA. Excluir os 13.395 não muda NADA:
 *
 *     A) índice inteiro       recall@5=62.8%  recall@10=76.0%  recall@5-prim=50.0%
 *     B) sem acordao-grafo    recall@5=62.8%  recall@10=76.0%  recall@5-prim=50.0%
 *     por query: 0 melhoraram · 0 pioraram · 55 sem mudança
 *
 * POR QUÊ: os 6.923 chunks têm embedding (0 nulos), mas raramente entram no
 * top-20 — em 25 queries do golden apareceram 9 vezes em ~483 resultados
 * (1,9%), contra 260 de `informativo`. São acórdãos de temas dispersos,
 * semanticamente distantes das queries do golden; estar no índice não é o
 * mesmo que disputar as primeiras posições.
 *
 * INSTRUMENTO VALIDADO antes de aceitar o resultado: excluindo `informativo`
 * (132 dos 256 alvos anotados) o recall@5 cai de 62,8% para 36,1% (−26,8pp),
 * provando que `excludeCategories` atua de verdade. Sem esse controle, o
 * "delta zero" seria indistinguível de um parâmetro ignorado.
 *
 * ⚠️ A causa da queda de −2,4pp segue NÃO identificada. Candidato mais
 * plausível: os 90 documentos não-grafo que entraram desde o baseline
 * (76 `acordao` + 14 `informativo`) — categorias que DOMINAM os resultados
 * (311 das ~483 aparições), logo com poder real de deslocar alvos do top-5.
 *
 * Os dois braços rodam na mesma execução, back-to-back, contra o mesmo estado
 * do banco — comparar com número medido em outro dia introduziria a variação
 * dos crons diários como variável extra.
 *
 * Custo: R$0 (embedding da query + FTS; nenhuma chamada de LLM).
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx eval/scripts/ab-exclui-acordao-grafo.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { hybridSearch } from '@/lib/embeddings/hybrid-search'
import { runEval } from '../runner'
import type { GoldenSet, SearchFn } from '../types'

function dedup(results: { documentId: string }[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const r of results) {
    if (!seen.has(r.documentId)) {
      seen.add(r.documentId)
      ids.push(r.documentId)
    }
  }
  return ids
}

/** Mesmos parâmetros do `baselineSearch`; a ÚNICA variável é excludeCategories. */
function makeSearch(excludeCategories?: string[]): SearchFn {
  return async (query: string) => {
    const start = Date.now()
    const response = await hybridSearch({
      query,
      limit: 20,
      alpha: 0.6,
      useCache: false,
      ...(excludeCategories ? { excludeCategories } : {}),
    })
    return { documentIds: dedup(response.results), latencyMs: Date.now() - start }
  }
}

function pct(x: number): string {
  return (x * 100).toFixed(1) + '%'
}

async function main() {
  const goldenSet: GoldenSet = JSON.parse(
    readFileSync(join(process.cwd(), 'eval/golden-set.json'), 'utf8')
  )
  console.log(`[ab] golden set: ${goldenSet.queries.length} queries`)

  console.log('\n[ab] braço A — baseline (índice inteiro)')
  const a = await runEval(goldenSet, makeSearch())

  console.log('[ab] braço B — sem acordao-grafo')
  const b = await runEval(goldenSet, makeSearch(['acordao-grafo']))

  const linha = (rot: string, s: typeof a.summary) =>
    `  ${rot.padEnd(26)} recall@5=${pct(s.recallAt5_avg)}  recall@10=${pct(s.recallAt10_avg)}  ` +
    `recall@5-prim=${pct(s.recallAt5Primary_avg)}  ` +
    `mrr=${s.mrr.toFixed(3)}  ndcg@10=${s.ndcgAt10_avg.toFixed(3)}`

  console.log('\n' + '='.repeat(96))
  console.log('RESULTADO — mesmo banco, mesma execução')
  console.log('='.repeat(96))
  console.log(linha('A) índice inteiro', a.summary))
  console.log(linha('B) sem acordao-grafo', b.summary))

  const d = (x: number, y: number) => {
    const v = (y - x) * 100
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}pp`
  }
  console.log('\n  delta (B - A):')
  console.log(`    recall@5       ${d(a.summary.recallAt5_avg, b.summary.recallAt5_avg)}`)
  console.log(`    recall@10      ${d(a.summary.recallAt10_avg, b.summary.recallAt10_avg)}`)
  console.log(`    recall@5-prim  ${d(a.summary.recallAt5Primary_avg, b.summary.recallAt5Primary_avg)}`)
  console.log(`    mrr            ${(b.summary.mrr - a.summary.mrr >= 0 ? '+' : '')}${(b.summary.mrr - a.summary.mrr).toFixed(3)}`)
  console.log(`    ndcg@10        ${(b.summary.ndcgAt10_avg - a.summary.ndcgAt10_avg >= 0 ? '+' : '')}${(b.summary.ndcgAt10_avg - a.summary.ndcgAt10_avg).toFixed(3)}`)

  // Quantas queries mudaram de resultado, para saber se o efeito é difuso ou concentrado
  const mapA = new Map(a.perQuery.map(q => [q.id, q.recallAt5]))
  let melhoraram = 0, pioraram = 0, iguais = 0
  for (const q of b.perQuery) {
    const ra = mapA.get(q.id)
    if (ra === undefined) continue
    if (q.recallAt5 > ra) melhoraram++
    else if (q.recallAt5 < ra) pioraram++
    else iguais++
  }
  console.log(`\n  por query (recall@5): ${melhoraram} melhoraram · ${pioraram} pioraram · ${iguais} sem mudança`)
  console.log('='.repeat(96))
}

main().catch((err) => {
  console.error('ERRO:', err)
  process.exit(1)
})
