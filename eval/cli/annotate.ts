/**
 * CLI interativa para anotar o golden set.
 *
 * Modos:
 *   tsx eval/cli/annotate.ts                       — lista queries não anotadas, escolhe uma
 *   tsx eval/cli/annotate.ts --id q-data-a-data    — anota uma query específica
 *   tsx eval/cli/annotate.ts --new                 — cria uma nova query do zero
 *
 * Para modo --id (e seleção da lista): roda baselineSearch, mostra top-10 com título +
 * conteúdo completo, usuário marca relevantes e highly relevant.
 * Inclui busca integrada de documentos por termo para encontrar IDs fora do top-10.
 * Salva em eval/golden-set.json.
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { select, input, confirm, checkbox } from '@inquirer/prompts'
import { hybridSearch } from '@/lib/embeddings/hybrid-search'
import { prisma } from '@/lib/prisma'
import type { GoldenSet, GoldenQuery, Difficulty } from '../types'

const GOLDEN_PATH = join(process.cwd(), 'eval/golden-set.json')

function loadGoldenSet(): GoldenSet {
  return JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))
}

function saveGoldenSet(gs: GoldenSet): void {
  writeFileSync(GOLDEN_PATH, JSON.stringify(gs, null, 2) + '\n', 'utf8')
}

/** Formata texto em linhas de ~100 chars com indentação */
function printWrapped(text: string, indent = '    '): void {
  const content = text.replace(/\s+/g, ' ').trim()
  const words = content.split(' ')
  let line = indent
  for (const word of words) {
    if (line.length + word.length > 100) {
      console.log(line)
      line = indent + word
    } else {
      line += (line.trim() ? ' ' : '') + word
    }
  }
  if (line.trim()) console.log(line)
}

/** Busca documentos no banco por termo (título, conteúdo, artigo de lei) */
async function searchDocuments(term: string): Promise<void> {
  console.log(`\nBuscando "${term}" no banco...\n`)

  // Buscar em Document
  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { content: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: { id: true, title: true, category: true, content: true },
    take: 15,
  })

  // Buscar em LeiArticle
  const articles = await prisma.leiArticle.findMany({
    where: {
      OR: [
        { numero: { contains: term, mode: 'insensitive' } },
        { ementa: { contains: term, mode: 'insensitive' } },
        { titulo: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: { id: true, numero: true, titulo: true, ementa: true, capitulo: true },
    take: 15,
  })

  const separator = '─'.repeat(80)

  if (docs.length > 0) {
    console.log(`=== Documentos encontrados: ${docs.length} ===\n`)
    docs.forEach((d, i) => {
      console.log(separator)
      console.log(`[D${i + 1}] ${d.title}`)
      console.log(`     Categoria: ${d.category}`)
      console.log(`     ID: ${d.id}`)
      if (d.content) {
        console.log()
        // Mostrar trecho do conteúdo ao redor do termo buscado
        const idx = d.content.toLowerCase().indexOf(term.toLowerCase())
        if (idx >= 0) {
          const start = Math.max(0, idx - 200)
          const end = Math.min(d.content.length, idx + term.length + 400)
          const snippet = (start > 0 ? '...' : '') + d.content.slice(start, end) + (end < d.content.length ? '...' : '')
          printWrapped(snippet)
        } else {
          printWrapped(d.content.slice(0, 500) + (d.content.length > 500 ? '...' : ''))
        }
      }
      console.log()
    })
  }

  if (articles.length > 0) {
    console.log(`\n=== Artigos da Lei 14.133 encontrados: ${articles.length} ===\n`)
    articles.forEach((a, i) => {
      console.log(separator)
      console.log(`[A${i + 1}] Art. ${a.numero}${a.titulo ? ' — ' + a.titulo : ''}`)
      console.log(`     Capítulo: ${a.capitulo}`)
      console.log(`     ID: ${a.id}`)
      console.log()
      printWrapped(a.ementa.slice(0, 800) + (a.ementa.length > 800 ? '...' : ''))
      console.log()
    })
  }

  if (docs.length === 0 && articles.length === 0) {
    console.log('Nenhum resultado encontrado.')
  }

  console.log(separator)
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
  const separator = '─'.repeat(80)
  top.forEach((r, i) => {
    console.log(separator)
    console.log(`[${i + 1}] ${r.documentTitle}`)
    console.log(`    Categoria: ${r.category} | Similaridade: ${(r.similarity * 100).toFixed(1)}%`)
    console.log(`    ID: ${r.documentId}`)
    console.log()
    printWrapped(r.chunkContent)
    console.log()
  })
  console.log(separator)

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

  // Etapa 3: busca integrada + adição manual de IDs
  let addMore = true
  while (addMore) {
    const action = await select({
      message: 'Documentos fora do top-10:',
      choices: [
        { name: 'Buscar documento por termo (título, conteúdo, nº artigo)', value: 'search' },
        { name: 'Colar ID manualmente', value: 'paste' },
        { name: 'Pronto, não preciso adicionar mais nada', value: 'done' },
      ],
    })

    if (action === 'search') {
      const term = await input({ message: 'Termo de busca (ex: "183", "data a data", "credenciamento"):' })
      if (term.trim()) {
        await searchDocuments(term.trim())
        const wantAdd = await confirm({ message: 'Quer adicionar algum ID dos resultados acima?', default: false })
        if (wantAdd) {
          const ids = await input({ message: 'Cole os IDs separados por vírgula:' })
          const extras = ids.split(',').map((s) => s.trim()).filter(Boolean)
          const isHR = await confirm({ message: 'Esses documentos são ALTAMENTE relevantes?', default: true })
          relevant.push(...extras)
          if (isHR) highlyRelevant.push(...extras)
        }
      }
    } else if (action === 'paste') {
      const ids = await input({ message: 'Cole os IDs separados por vírgula:' })
      const extras = ids.split(',').map((s) => s.trim()).filter(Boolean)
      if (extras.length > 0) {
        const isHR = await confirm({ message: 'Esses documentos são ALTAMENTE relevantes?', default: true })
        relevant.push(...extras)
        if (isHR) highlyRelevant.push(...extras)
      }
    } else {
      addMore = false
    }
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
      name: `${q.annotations.annotatedAt ? '[x]' : '[ ]'} ${q.id} — ${q.query}`,
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
