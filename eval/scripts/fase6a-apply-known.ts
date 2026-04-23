/**
 * Sub-fase 6A do ROADMAP_BUSCA_QUALIDADE: aplica operações conhecidas
 * ao eval/golden-set.json.
 *
 * Modos:
 *   npx dotenv -e .env.local -- tsx eval/scripts/fase6a-apply-known.ts
 *     Interativo: prompts pra multi-matches e confirm final.
 *
 *   npx dotenv -e .env.local -- tsx eval/scripts/fase6a-apply-known.ts --auto
 *     Auto: picks first match em multi-matches, aceita dedups, NÃO salva.
 *     (Usar para preview automatizado.)
 *
 *   npx dotenv -e .env.local -- tsx eval/scripts/fase6a-apply-known.ts --auto --apply
 *     Auto + persist. Usar depois de revisar o diff do --auto.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { select, confirm } from '@inquirer/prompts'
import { prisma } from '@/lib/prisma'
import type { GoldenSet, GoldenQuery } from '../types'
import { KNOWN_OPERATIONS } from './golden-audit/known-operations'
import { addToAnnotations, removeFromAnnotations } from './golden-audit/golden-ops'
import type { KnownOperation } from './golden-audit/types'

const GOLDEN_PATH = join(process.cwd(), 'eval/golden-set.json')

const AUTO = process.argv.includes('--auto')
const APPLY = process.argv.includes('--apply')

interface ResolvedOp {
  queryId: string
  addIds: Array<{ id: string; list: 'relevant' | 'highly'; title: string }>
  removeIds: Array<{ id: string; previousTitle?: string }>
}

async function resolveTitleToId(titleQuery: string): Promise<{ id: string; title: string } | null> {
  const docs = await prisma.document.findMany({
    where: { title: { contains: titleQuery, mode: 'insensitive' } },
    select: { id: true, title: true },
    take: 5,
  })
  if (docs.length === 0) {
    console.log(`  ✗ Nenhum match para "${titleQuery}"`)
    return null
  }
  if (docs.length === 1) {
    console.log(`  ✓ Match único: ${docs[0].title.slice(0, 80)} (${docs[0].id.slice(0, 8)})`)
    return docs[0]
  }
  // Múltiplos matches
  if (AUTO) {
    console.log(`  ⚠ ${docs.length} matches para "${titleQuery}" — AUTO: escolhendo primeiro.`)
    for (const d of docs) console.log(`      [${d.id === docs[0].id ? '✓' : ' '}] ${d.title.slice(0, 90)} (${d.id.slice(0, 8)})`)
    return docs[0]
  }
  const choice = await select<string | null>({
    message: `  ${docs.length} matches para "${titleQuery}" — escolha:`,
    choices: [
      ...docs.map((d) => ({
        name: `${d.title.slice(0, 100)} (${d.id.slice(0, 8)})`,
        value: d.id,
      })),
      { name: '(pular — não adicionar)', value: null },
    ],
  })
  if (choice === null) return null
  const picked = docs.find((d) => d.id === choice)!
  return picked
}

async function resolveRemoveId(
  idPrefix: string,
  golden: GoldenSet
): Promise<{ id: string; title: string | null } | null> {
  if (idPrefix.length === 36) {
    // Full UUID — busca direto
    const doc = await prisma.document.findUnique({
      where: { id: idPrefix },
      select: { id: true, title: true },
    })
    return doc ? { id: doc.id, title: doc.title } : { id: idPrefix, title: null }
  }
  // Prefixo — busca via ILIKE
  const docs = await prisma.$queryRaw<Array<{ id: string; title: string }>>`
    SELECT id, title FROM "Document" WHERE id::text LIKE ${idPrefix + '%'} LIMIT 5
  `
  if (docs.length === 0) {
    // Fallback: procurar prefix nas annotations do próprio golden
    const byPrefix = new Set<string>()
    for (const q of golden.queries) {
      for (const id of q.annotations.relevant) {
        if (id.toLowerCase().startsWith(idPrefix.toLowerCase())) byPrefix.add(id)
      }
    }
    if (byPrefix.size === 1) {
      const id = Array.from(byPrefix)[0]
      console.log(`  ⚠ Prefix "${idPrefix}" não encontrado no DB, mas existe no golden como "${id.slice(0, 8)}..." — removendo pelo golden.`)
      return { id, title: '(doc deletado do DB)' }
    }
    if (byPrefix.size > 1) {
      console.log(`  ⚠ Prefix "${idPrefix}" ambíguo: ${byPrefix.size} IDs no golden começam com esse prefix. Pulando remoção.`)
      return null
    }
    // Nem DB nem golden tem esse prefix — aviso claro
    console.log(`  ⚠ Prefix "${idPrefix}" não resolve em nenhum doc (DB ou golden). Pulando remoção.`)
    return null
  }
  if (docs.length === 1) return { id: docs[0].id, title: docs[0].title }
  const choice = await select<string>({
    message: `  Múltiplos docs com prefixo "${idPrefix}" — escolha:`,
    choices: docs.map((d) => ({ name: `${d.title.slice(0, 80)} (${d.id.slice(0, 8)})`, value: d.id })),
  })
  const picked = docs.find((d) => d.id === choice)!
  return picked
}

async function dedupSpotCheck(golden: GoldenSet): Promise<ResolvedOp[]> {
  console.log('\n=== Spot-check de dedup ===')
  const dups = await prisma.$queryRaw<Array<{ title: string; dups: number; ids: string[] }>>`
    SELECT title, COUNT(*)::int AS dups, array_agg(id::text) AS ids
    FROM "Document"
    GROUP BY title
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `

  // Filtrar pelos que afetam o golden (algum ID aparece em annotation.relevant)
  const goldenIds = new Set<string>()
  for (const q of golden.queries) {
    for (const id of q.annotations.relevant) goldenIds.add(id)
  }

  const relevant = dups.filter((d) => d.ids.some((id) => goldenIds.has(id)))
  console.log(`Encontrados ${dups.length} títulos duplicados no banco; ${relevant.length} afetam o golden.`)

  if (relevant.length === 0) {
    console.log('Nada a fazer pelo dedup.\n')
    return []
  }

  if (relevant.length > 15) {
    console.log(
      `⚠ ${relevant.length} pares afetam o golden — acima do threshold de 15 definido no spec. ` +
        `Recomendado registrar "Fase 7 — Dedup estrutural" no roadmap e só aplicar dedup defensivo seletivo aqui.`
    )
    if (AUTO) {
      console.log('  AUTO: continuando.')
    } else {
      const proceed = await confirm({ message: 'Continuar e tratar só os casos óbvios (esp-785767-20)?', default: true })
      if (!proceed) return []
    }
  }

  const ops: ResolvedOp[] = []
  for (const dup of relevant) {
    console.log(`\nTítulo: "${dup.title}"`)
    console.log(`IDs: ${dup.ids.join(', ')}`)
    const inGolden = dup.ids.filter((id) => goldenIds.has(id))
    const notInGolden = dup.ids.filter((id) => !goldenIds.has(id))
    console.log(`Já anotados: ${inGolden.join(', ') || '(nenhum)'}`)
    console.log(`Não anotados: ${notInGolden.join(', ') || '(nenhum)'}`)

    // Para cada query do golden que contém algum desses IDs, oferecer adicionar os NOT-in-golden
    if (notInGolden.length === 0) {
      console.log('  → Todos IDs já anotados; nada a adicionar.')
      continue
    }

    for (const q of golden.queries) {
      const overlap = q.annotations.relevant.filter((id) => inGolden.includes(id))
      if (overlap.length === 0) continue
      let apply: boolean
      if (AUTO) {
        console.log(`  AUTO: adicionando ${notInGolden.join(', ')} em "${q.id}" (${overlap.length} ID(s) já anotados).`)
        apply = true
      } else {
        apply = await confirm({
          message: `  Query "${q.id}" tem ${overlap.length} ID(s) desse doc anotados. Adicionar o(s) duplicado(s) ${notInGolden.join(', ')} também?`,
          default: true,
        })
      }
      if (!apply) continue
      const isHighly = q.annotations.highlyRelevant.some((id) => overlap.includes(id))
      const list = isHighly ? 'highly' : 'relevant'
      ops.push({
        queryId: q.id,
        addIds: notInGolden.map((id) => ({ id, list, title: dup.title })),
        removeIds: [],
      })
    }
  }
  return ops
}

async function resolveKnownOperation(
  op: KnownOperation,
  golden: GoldenSet
): Promise<ResolvedOp> {
  console.log(`\n=== Query ${op.queryId} ===`)
  console.log(`Descrição: ${op.description}`)

  const addIds: ResolvedOp['addIds'] = []
  for (const entry of op.addByTitle) {
    const resolved = await resolveTitleToId(entry.titleQuery)
    if (resolved) {
      addIds.push({ id: resolved.id, list: entry.list, title: resolved.title })
    }
  }
  for (const entry of op.addById) {
    const doc = await prisma.document.findUnique({
      where: { id: entry.id },
      select: { title: true },
    })
    addIds.push({ id: entry.id, list: entry.list, title: doc?.title ?? '(não encontrado)' })
  }

  const removeIds: ResolvedOp['removeIds'] = []
  for (const idPrefix of op.removeIds) {
    const resolved = await resolveRemoveId(idPrefix, golden)
    if (resolved) removeIds.push({ id: resolved.id, previousTitle: resolved.title ?? undefined })
  }

  console.log(`  Resumo: ${addIds.length} adições + ${removeIds.length} remoções`)
  return { queryId: op.queryId, addIds, removeIds }
}

function applyResolvedOps(golden: GoldenSet, ops: ResolvedOp[]): GoldenSet {
  const newQueries: GoldenQuery[] = golden.queries.map((q) => {
    const queryOps = ops.filter((op) => op.queryId === q.id)
    if (queryOps.length === 0) return q
    if (queryOps.length > 1) {
      console.log(`  ⚠ Query ${q.id} tem ${queryOps.length} operações no mesmo plano (dedup + known_op?). Aplicando em ordem.`)
    }
    let ann = q.annotations
    for (const op of queryOps) {
      for (const add of op.addIds) ann = addToAnnotations(ann, add.id, add.list)
      for (const rem of op.removeIds) ann = removeFromAnnotations(ann, rem.id)
    }
    return {
      ...q,
      annotations: {
        ...ann,
        annotatedAt: new Date().toISOString(),
        annotatedBy: ann.annotatedBy ?? 'fase6a',
        notes: ann.notes?.includes('[Fase 6A')
          ? ann.notes
          : [ann.notes, '[Fase 6A — 2026-04-23]'].filter(Boolean).join(' '),
      },
    }
  })
  return { ...golden, queries: newQueries }
}

function summarizeDiff(before: GoldenSet, after: GoldenSet): string {
  const lines: string[] = []
  const byIdBefore = new Map(before.queries.map((q) => [q.id, q]))
  for (const q of after.queries) {
    const prev = byIdBefore.get(q.id)!
    const rAdded = q.annotations.relevant.filter((id) => !prev.annotations.relevant.includes(id))
    const rRemoved = prev.annotations.relevant.filter((id) => !q.annotations.relevant.includes(id))
    const hAdded = q.annotations.highlyRelevant.filter((id) => !prev.annotations.highlyRelevant.includes(id))
    const hRemoved = prev.annotations.highlyRelevant.filter((id) => !q.annotations.highlyRelevant.includes(id))
    if (rAdded.length || rRemoved.length || hAdded.length || hRemoved.length) {
      lines.push(`${q.id}:`)
      if (rAdded.length) lines.push(`  + relevant: ${rAdded.map((id) => id.slice(0, 8)).join(', ')}`)
      if (rRemoved.length) lines.push(`  - relevant: ${rRemoved.map((id) => id.slice(0, 8)).join(', ')}`)
      if (hAdded.length) lines.push(`  + highly:   ${hAdded.map((id) => id.slice(0, 8)).join(', ')}`)
      if (hRemoved.length) lines.push(`  - highly:   ${hRemoved.map((id) => id.slice(0, 8)).join(', ')}`)
    }
  }
  return lines.join('\n')
}

async function main() {
  const golden: GoldenSet = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))
  const beforeSnapshot: GoldenSet = JSON.parse(JSON.stringify(golden))

  const allOps: ResolvedOp[] = []

  // 1. Spot-check de dedup
  const dedupOps = await dedupSpotCheck(golden)
  allOps.push(...dedupOps)

  // 2. Operações conhecidas (8 E + 2 fantasmas)
  console.log('\n=== Aplicando operações conhecidas ===')
  for (const op of KNOWN_OPERATIONS) {
    const resolved = await resolveKnownOperation(op, golden)
    allOps.push(resolved)
  }

  // 3. Aplicar em memória
  const afterGolden = applyResolvedOps(golden, allOps)

  // 4. Mostrar diff
  console.log('\n=== DIFF consolidado ===')
  const diff = summarizeDiff(beforeSnapshot, afterGolden)
  console.log(diff || '(sem mudanças)')

  // 5. Confirmar save
  let save: boolean
  if (AUTO) {
    if (!APPLY) {
      console.log('\n[AUTO] Preview-only. Use --auto --apply para persistir.')
      return
    }
    console.log('\n[AUTO --apply] Salvando sem prompt.')
    save = true
  } else {
    save = await confirm({ message: '\nSalvar golden-set.json com essas mudanças?', default: false })
  }
  if (!save) {
    console.log('Abortado. Nada gravado.')
    return
  }

  writeFileSync(GOLDEN_PATH, JSON.stringify(afterGolden, null, 2) + '\n', 'utf8')
  console.log('✓ golden-set.json salvo.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('[fase6a] FAILED:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
