/**
 * Etapa 2: correlaciona referencias parseadas com documentIds no banco do sitedobarral.
 * Match exato por campos estruturados (acordaoNumero, onNumber), fallback por title ILIKE,
 * fallback semantico via hybridSearch.
 */
import { prisma } from '@/lib/prisma'
import { hybridSearch } from '@/lib/embeddings/hybrid-search'
import type { ParsedReference } from './extract-theses'

export interface ResolvedReference extends ParsedReference {
  documentId: string | null
  resolvedBy: 'exact_field' | 'title_match' | 'semantic' | 'not_found'
  documentTitle?: string
}

/**
 * Resolve uma unica referencia contra o banco.
 */
async function resolveOne(ref: ParsedReference): Promise<ResolvedReference> {
  const base: ResolvedReference = { ...ref, documentId: null, resolvedBy: 'not_found' }

  // 1. Match exato por campos estruturados
  if (ref.type === 'acordao_tcu' && ref.numero && ref.ano) {
    const doc = await prisma.document.findFirst({
      where: { acordaoNumero: ref.numero, acordaoAno: ref.ano },
      select: { id: true, title: true },
    })
    if (doc) return { ...base, documentId: doc.id, resolvedBy: 'exact_field', documentTitle: doc.title }
  }

  if (ref.type === 'on_agu' && ref.numero && ref.ano) {
    const doc = await prisma.document.findFirst({
      where: { onNumber: ref.numero, onYear: ref.ano },
      select: { id: true, title: true },
    })
    if (doc) return { ...base, documentId: doc.id, resolvedBy: 'exact_field', documentTitle: doc.title }
  }

  if (ref.type === 'sumula_tcu' && ref.numero) {
    const doc = await prisma.document.findFirst({
      where: { title: { contains: `Súmula ${ref.numero}`, mode: 'insensitive' } },
      select: { id: true, title: true },
    })
    if (doc) return { ...base, documentId: doc.id, resolvedBy: 'title_match', documentTitle: doc.title }
  }

  // 2. Fallback por titulo ILIKE (para pareceres, decretos, INs)
  if (ref.type !== 'lei' && ref.type !== 'outro') {
    const searchTerm = ref.raw
      .replace(/,\s*art\..*$/i, '')
      .replace(/,\s*de\s+aplicação.*$/i, '')
      .trim()
      .slice(0, 80)

    if (searchTerm.length > 10) {
      const doc = await prisma.document.findFirst({
        where: { title: { contains: searchTerm, mode: 'insensitive' } },
        select: { id: true, title: true },
      })
      if (doc) return { ...base, documentId: doc.id, resolvedBy: 'title_match', documentTitle: doc.title }
    }
  }

  // 3. Fallback semantico (exceto leis puras - nao sao documentos no indice)
  if (ref.type !== 'lei') {
    try {
      const response = await hybridSearch({ query: ref.raw, limit: 3, useCache: false })
      if (response.results.length > 0 && response.results[0].similarity >= 0.7) {
        const top = response.results[0]
        return {
          ...base,
          documentId: top.documentId,
          resolvedBy: 'semantic',
          documentTitle: top.documentTitle,
        }
      }
    } catch {
      // hybridSearch failed — skip semantic fallback
    }
  }

  return base
}

/**
 * Resolve todas as referencias de uma lista de teses.
 * Retorna mapeamento ref.raw -> ResolvedReference.
 */
export async function resolveAllFundamentos(
  allRefs: ParsedReference[]
): Promise<Map<string, ResolvedReference>> {
  const cache = new Map<string, ResolvedReference>()

  // Deduplicate by raw text
  const unique = [...new Set(allRefs.map(r => r.raw))]
  const refMap = new Map(allRefs.map(r => [r.raw, r]))

  console.log(`  Resolvendo ${unique.length} referencias unicas...`)
  let resolved = 0
  let notFound = 0

  for (const raw of unique) {
    const ref = refMap.get(raw)!
    const result = await resolveOne(ref)
    cache.set(raw, result)

    if (result.documentId) {
      resolved++
    } else {
      notFound++
    }
  }

  console.log(`  ${resolved} resolvidas, ${notFound} nao encontradas`)
  return cache
}
