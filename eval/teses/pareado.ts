/**
 * Mede quanto as teses deslocam os acórdãos antes de ligá-las no assistente
 * (spec §9: "a eficácia é medida, não presumida").
 *
 * Para cada query do golden set, roda a mesma busca híbrida duas vezes, sem e
 * com o ramo das teses, e compara o top-5. Tudo é idêntico entre as duas
 * execuções exceto o ramo, o que torna a comparação pareada. `useCache: false`
 * é obrigatório: com cache, a segunda execução poderia devolver a primeira.
 *
 * Os parâmetros são os do `baselineSearch` (eval/search-adapter.ts): limit 20,
 * alpha 0.6. A visibilidade é 'acervo', o recorte com mais teses.
 *
 * Só leitura. Custo: embeddings da query e FTS, sem LLM.
 *
 * Uso:
 *   npm run eval:teses
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { hybridSearch } from '@/lib/embeddings/hybrid-search'
import { prisma } from '@/lib/prisma'
import type { GoldenSet } from '../types'
import { medirPar, histograma, piores, TOP, type Medida } from './medida'

async function main() {
  // Sem chunk de tese a medição mede nada: as duas listas sairiam iguais e o
  // relatório diria "nenhum deslocamento", que é falso.
  const indexadas = await prisma.teseEnunciadoChunk.count()
  if (indexadas === 0) {
    console.error(
      'O índice das teses está vazio. Aplique a migração de TeseEnunciadoChunk e deixe o cron ' +
        'process-index-jobs indexar as teses antes de medir.',
    )
    process.exitCode = 1
    return
  }
  console.log(`${indexadas} teses indexadas.\n`)

  // O golden set é um objeto com metadados, não um array: as perguntas estão
  // em `queries`. Iterar o objeto direto devolve zero medições em silêncio.
  const golden: GoldenSet = JSON.parse(readFileSync(join(process.cwd(), 'eval/golden-set.json'), 'utf8'))

  const medidas: Medida[] = []
  const entradas: Record<string, string[]> = {}

  for (const q of golden.queries) {
    const base = { query: q.query, limit: 20, alpha: 0.6, useCache: false }
    const sem = await hybridSearch(base)
    const com = await hybridSearch({ ...base, includeTeses: true, tesesVisibilidade: 'acervo' })

    const m = medirPar(q.query, sem.results, com.results, q.annotations.relevant)
    medidas.push(m)

    const topSem = new Set(sem.results.slice(0, TOP).map((r) => r.documentId))
    entradas[q.query] = com.results
      .slice(0, TOP)
      .filter((r) => !topSem.has(r.documentId))
      .map((r) => `${r.sourceType === 'tese' ? 'tese' : r.sourceType}:${r.documentTitle}`)

    process.stdout.write('.')
  }
  console.log('\n')

  const hist = histograma(medidas)
  const ruins = piores(medidas)
  const media = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0)

  mkdirSync(join(process.cwd(), 'eval/reports'), { recursive: true })
  const arquivo = `eval/reports/teses-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(
    arquivo,
    JSON.stringify({ indexadas, top: TOP, histograma: hist, piores: ruins, entradas, medidas }, null, 2),
  )

  console.log(`Relatório em ${arquivo}\n`)
  console.log(`Queries por nº de resultados deslocados do top-${TOP}:`)
  for (const [n, qtd] of Object.entries(hist).sort(([a], [b]) => Number(a) - Number(b))) {
    console.log(`  ${n} deslocado(s): ${qtd} query(ies)`)
  }
  const relevantesPerdidos = medidas.reduce((s, m) => s + m.relevantesDeslocados.length, 0)
  console.log(`\nResultados anotados como relevantes que saíram do top-${TOP}: ${relevantesPerdidos}`)
  console.log(
    `Posição média dos resultados que não são tese: ${media(medidas.map((m) => m.posicaoMediaAntes)).toFixed(2)} → ` +
      `${media(medidas.map((m) => m.posicaoMediaDepois)).toFixed(2)}`,
  )
  console.log('\nAs três piores:')
  for (const p of ruins) {
    console.log(`  "${p.query}": perdeu ${p.deslocados.length} (${p.relevantesDeslocados.length} relevante[s])`)
    console.log(`    saíram: ${p.deslocados.join(', ') || 'nenhum'}`)
    console.log(`    entraram: ${entradas[p.query].join(' | ') || 'nenhum'}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
