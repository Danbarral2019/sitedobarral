import { prisma } from '@/lib/prisma'
import { hybridSearch } from '@/lib/embeddings/hybrid-search'

/** Busca metadados de um doc + contagem de chunks. Resultado cacheado por id. */
const docCache = new Map<string, {
  exists: boolean
  title: string | null
  contentLen: number
  chunkCount: number
}>()

export async function fetchDocSignal(id: string): Promise<{
  id: string
  exists: boolean
  title: string | null
  contentLen: number
  chunkCount: number
}> {
  const hit = docCache.get(id)
  if (hit) return { id, ...hit }

  const [doc, chunkCount] = await Promise.all([
    prisma.document.findUnique({
      where: { id },
      select: { title: true, content: true },
    }),
    prisma.documentChunk.count({ where: { documentId: id } }),
  ])

  const result = {
    exists: doc !== null,
    title: doc?.title ?? null,
    contentLen: doc?.content?.length ?? 0,
    chunkCount,
  }
  docCache.set(id, result)
  return { id, ...result }
}

/** Busca content integral de múltiplos docs para matching de key terms. */
export async function fetchDocContents(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: { id: true, content: true },
  })
  const out: Record<string, string> = {}
  for (const d of docs) out[d.id] = d.content ?? ''
  return out
}

/** Busca títulos de múltiplos docs (para top-5 no CSV). */
export async function fetchDocTitles(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true },
  })
  const out: Record<string, string> = {}
  for (const d of docs) out[d.id] = d.title
  return out
}

/**
 * Roda hybridSearch com limit 100 e retorna a primeira posição em que algum
 * dos docs relevantes aparece, ou null se nenhum aparece.
 * Usado só quando MRR = 0 no top-20 (o doc está fora do top-20 — queremos
 * saber se está no top-100).
 */
export async function findFirstRelevantPositionInTop100(
  query: string,
  relevantIds: string[]
): Promise<number | null> {
  const relevantSet = new Set(relevantIds)
  const res = await hybridSearch({ query, limit: 100, alpha: 0.6, useCache: false })
  for (let i = 0; i < res.results.length; i++) {
    if (relevantSet.has(res.results[i].documentId)) return i + 1 // 1-indexed
  }
  return null
}
