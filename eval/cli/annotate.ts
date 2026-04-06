/**
 * CLI interativa para anotar o golden set.
 *
 * Modos:
 *   tsx eval/cli/annotate.ts                       — lista queries não anotadas, escolhe uma
 *   tsx eval/cli/annotate.ts --id q-data-a-data    — anota uma query específica
 *   tsx eval/cli/annotate.ts --new                 — cria uma nova query do zero
 *
 * Para modo --id (e seleção da lista): roda baselineSearch, mostra top-10 com título +
 * trecho, usuário marca cada um como (h)ighly relevant, (r)elevant ou (n)othing.
 * Salva em eval/golden-set.json.
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { select, input, confirm, checkbox } from '@inquirer/prompts'
import { hybridSearch } from '@/lib/embeddings/hybrid-search'
import type { GoldenSet, GoldenQuery, Difficulty } from '../types'

const GOLDEN_PATH = join(process.cwd(), 'eval/golden-set.json')

function loadGoldenSet(): GoldenSet {
  return JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))
}

function saveGoldenSet(gs: GoldenSet): void {
  writeFileSync(GOLDEN_PATH, JSON.stringify(gs, null, 2) + '\n', 'utf8')
}

async function annotateQuery(gs: GoldenSet, q: GoldenQuery): Promise<void> {
  console.log(`\n=== Annotating: ${q.id} ===`)
  console.log(`Query: "${q.query}"`)
  console.log(`Description: ${q.description}`)
  console.log(`Difficulty: ${q.difficulty}`)
  console.log()
  console.log('Running hybridSearch top-20...')

  const response = await hybridSearch({
    query: q.query,
    limit: 20,
    useCache: false,
  })

  // Dedup por documentId mantendo o primeiro chunk de cada
  const byDoc = new Map<string, typeof response.results[number]>()
  for (const r of response.results) {
    if (!byDoc.has(r.documentId)) byDoc.set(r.documentId, r)
  }
  const top = Array.from(byDoc.values()).slice(0, 10)

  console.log(`\nTop ${top.length} unique documents:\n`)
  top.forEach((r, i) => {
    console.log(`[${i + 1}] (${r.category}) ${r.documentTitle}`)
    console.log(`     ID: ${r.documentId}`)
    console.log(`     ${r.chunkContent.slice(0, 200).replace(/\s+/g, ' ')}...`)
    console.log()
  })

  // Etapa 1: marcar relevantes (multi-select)
  const relevantChoices = top.map((r, i) => ({
    name: `[${i + 1}] ${r.documentTitle.slice(0, 80)}`,
    value: r.documentId,
  }))
  const relevant = await checkbox({
    message: 'Quais destes documentos são RELEVANTES para a query? (espaço para marcar, enter para confirmar)',
    choices: relevantChoices,
  })

  // Etapa 2: subset highly relevant
  let highlyRelevant: string[] = []
  if (relevant.length > 0) {
    const hrChoices = relevant.map((id) => {
      const r = top.find((x) => x.documentId === id)!
      return { name: r.documentTitle.slice(0, 80), value: id }
    })
    highlyRelevant = await checkbox({
      message: 'Dos relevantes acima, quais são ALTAMENTE relevantes (a melhor resposta)?',
      choices: hrChoices,
    })
  }

  // Etapa 3: também aceita IDs colados manualmente (caso o doc certo não esteja no top-10)
  const addManual = await confirm({
    message: 'Quer adicionar IDs de documentos relevantes que NÃO estavam no top-10?',
    default: false,
  })
  if (addManual) {
    const ids = await input({
      message: 'Cole os documentIds separados por vírgula:',
    })
    const extras = ids.split(',').map((s) => s.trim()).filter(Boolean)
    relevant.push(...extras)
  }

  const annotatedBy = await input({ message: 'Seu nome (para auditoria):', default: 'daniel' })
  const notes = await input({ message: 'Notas adicionais (opcional):', default: q.annotations.notes })

  q.annotations = {
    relevant: Array.from(new Set(relevant)),
    highlyRelevant: Array.from(new Set(highlyRelevant)),
    annotatedAt: new Date().toISOString(),
    annotatedBy,
    notes,
  }

  saveGoldenSet(gs)
  console.log(`\n✓ Saved annotations for ${q.id}`)
}

async function createNewQuery(gs: GoldenSet): Promise<GoldenQuery> {
  const query = await input({ message: 'Texto da query:' })
  const id = await input({
    message: 'ID (slug, ex: q-prazo-recurso):',
    default: 'q-' + query.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30),
  })
  const description = await input({ message: 'Descrição (o que esperava encontrar):' })
  const category = await input({ message: 'Categoria/tag (ex: termo-juridico-especifico):' })
  const difficulty = (await select({
    message: 'Dificuldade:',
    choices: [
      { name: 'easy', value: 'easy' as Difficulty },
      { name: 'medium', value: 'medium' as Difficulty },
      { name: 'hard', value: 'hard' as Difficulty },
    ],
  })) as Difficulty

  const newQ: GoldenQuery = {
    id,
    query,
    description,
    category,
    difficulty,
    annotations: {
      relevant: [],
      highlyRelevant: [],
      annotatedAt: null,
      annotatedBy: null,
      notes: '',
    },
  }
  gs.queries.push(newQ)
  saveGoldenSet(gs)
  console.log(`✓ Created ${id}`)
  return newQ
}

async function main() {
  const args = process.argv.slice(2)
  const idArg = args.includes('--id') ? args[args.indexOf('--id') + 1] : undefined
  const isNew = args.includes('--new')

  const gs = loadGoldenSet()

  let target: GoldenQuery
  if (isNew) {
    target = await createNewQuery(gs)
  } else if (idArg) {
    const found = gs.queries.find((q) => q.id === idArg)
    if (!found) throw new Error(`Query id "${idArg}" not found`)
    target = found
  } else {
    const choices = gs.queries.map((q) => ({
      name: `${q.annotations.relevant.length === 0 ? '[ ]' : '[x]'} ${q.id} — ${q.query}`,
      value: q.id,
    }))
    const id = await select({ message: 'Qual query anotar?', choices })
    target = gs.queries.find((q) => q.id === id)!
  }

  await annotateQuery(gs, target)
}

main().catch((err) => {
  console.error('[annotate] FAILED:', err)
  process.exit(1)
})
