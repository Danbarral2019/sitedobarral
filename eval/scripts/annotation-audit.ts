/**
 * Sub-fase 6B passo 1: gera CSV de candidatos à anotação.
 *
 * Uso:
 *   npx dotenv -e .env.local -- tsx eval/scripts/annotation-audit.ts \
 *     --from eval/reports/<stamp>_diag-fase0.json \
 *     --skip-queries q-data-a-data,t-pesquisa-precos-in65-01,...
 *     --threshold 10
 *
 * Para cada query anotada (exceto skip list):
 * - Lê predicted[0..threshold-1].
 * - Filtra docs não presentes em annotations.relevant.
 * - Coleta title + snippet + posição via db-signals (Fase 0).
 * - Aplica heurística classifyCandidate.
 * - Emite linha no CSV.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EvalRun, GoldenSet } from '../types'
import { extractKeyTerms } from './failure-analysis/key-terms'
import { fetchDocTitles, fetchDocContents } from './failure-analysis/db-signals'
import { classifyCandidate } from './golden-audit/heuristic'
import { formatAuditCSV } from './golden-audit/csv-audit'
import type { AuditCandidate } from './golden-audit/types'
import { prisma } from '@/lib/prisma'

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const from = get('--from')
  const skipRaw = get('--skip-queries')
  const skip = skipRaw ? new Set(skipRaw.split(',').map((s) => s.trim()).filter(Boolean)) : new Set<string>()
  const thresholdRaw = get('--threshold')
  const threshold = thresholdRaw !== undefined ? parseInt(thresholdRaw, 10) : 10
  if (!from) throw new Error('--from <path-to-eval-json> é obrigatório')
  return { from, skip, threshold }
}

function snippetAround(content: string, keyTerms: string[], windowChars = 500): string {
  if (!content) return ''
  const lc = content.toLowerCase()
  for (const t of keyTerms) {
    const idx = lc.indexOf(t.toLowerCase())
    if (idx >= 0) {
      const start = Math.max(0, idx - windowChars / 2)
      const end = Math.min(content.length, idx + t.length + windowChars / 2)
      return (start > 0 ? '...' : '') + content.slice(start, end).replace(/\s+/g, ' ') + (end < content.length ? '...' : '')
    }
  }
  return content.slice(0, windowChars).replace(/\s+/g, ' ') + (content.length > windowChars ? '...' : '')
}

async function main() {
  const { from, skip, threshold } = parseArgs()

  console.log(`[audit] Lendo run: ${from}`)
  const run: EvalRun = JSON.parse(readFileSync(from, 'utf8'))
  const golden: GoldenSet = JSON.parse(readFileSync(join(process.cwd(), 'eval/golden-set.json'), 'utf8'))

  // Queries a auditar: anotadas, não na skip list
  const annotated = golden.queries.filter((q) => q.annotations.relevant.length > 0 && !skip.has(q.id))
  console.log(`[audit] Auditando ${annotated.length} queries (skip=${skip.size})`)

  const allCandidates: AuditCandidate[] = []

  for (let i = 0; i < annotated.length; i++) {
    const q = annotated[i]
    const result = run.perQuery.find((r) => r.id === q.id)
    if (!result) {
      console.warn(`[audit] Query ${q.id} sem resultado no eval run; pulando`)
      continue
    }
    console.log(`[audit] ${i + 1}/${annotated.length} — ${q.id}`)

    const keyTerms = extractKeyTerms(q.query)
    const topIds = result.predicted.slice(0, threshold)
    const existingRelevants = new Set(q.annotations.relevant)
    const candidateIds = topIds.filter((id) => !existingRelevants.has(id))
    if (candidateIds.length === 0) continue

    // Buscar título + content dos candidatos
    const [titles, contents] = await Promise.all([
      fetchDocTitles(candidateIds),
      fetchDocContents(candidateIds),
    ])

    for (const id of candidateIds) {
      const position = topIds.indexOf(id) + 1 // 1-indexed
      const title = titles[id] ?? '(doc não encontrado)'
      const content = contents[id] ?? ''
      const snippet = snippetAround(content, keyTerms)
      const suggestAuto = classifyCandidate({
        position,
        candidateTitle: title,
        candidateContent: content,
        keyTerms,
      })
      allCandidates.push({
        queryId: q.id,
        queryText: q.query,
        candidateId: id,
        candidateTitle: title,
        candidatePosition: position,
        candidateSnippet: snippet,
        existingRelevantsCount: q.annotations.relevant.length,
        suggestAuto,
      })
    }
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const outPath = join(process.cwd(), 'eval/reports', `annotation-audit-${stamp}.csv`)
  writeFileSync(outPath, formatAuditCSV(allCandidates), 'utf8')
  console.log(`[audit] CSV: ${outPath}`)
  console.log(`[audit] Total candidatos: ${allCandidates.length}`)

  const counts: Record<string, number> = {}
  for (const c of allCandidates) counts[c.suggestAuto] = (counts[c.suggestAuto] ?? 0) + 1
  console.log('[audit] Distribuição suggest_auto:')
  for (const [k, v] of Object.entries(counts).sort()) console.log(`[audit]   ${k}: ${v}`)
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0) })
  .catch(async (err) => {
    console.error('[audit] FAILED:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
