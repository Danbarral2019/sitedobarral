/**
 * Sub-fase 6B passo 2: aplica decisões do CSV de auditoria ao golden-set.json.
 *
 * Uso:
 *   npx dotenv -e .env.local -- tsx eval/scripts/fase6b-apply-audit.ts \
 *     --csv eval/reports/annotation-audit-2026-04-23.csv [--apply]
 *
 * Dry-run por default. Com --apply, persiste. Cria backup .bak-<data>.
 * Append-only: nunca remove IDs existentes.
 */

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GoldenSet } from '../types'
import { parseAuditCSV } from './golden-audit/csv-audit'
import { addToAnnotations } from './golden-audit/golden-ops'
import type { AuditRow } from './golden-audit/types'

const GOLDEN_PATH = join(process.cwd(), 'eval/golden-set.json')

function parseArgs() {
  const args = process.argv.slice(2)
  const csvIdx = args.indexOf('--csv')
  if (csvIdx < 0) throw new Error('--csv <path> é obrigatório')
  return {
    csvPath: args[csvIdx + 1],
    apply: args.includes('--apply'),
  }
}

interface Summary {
  acceptCount: number
  acceptHighlyCount: number
  rejectCount: number
  commentCount: number
  emptyCount: number
  queriesAffected: Set<string>
}

function applyDecisions(golden: GoldenSet, rows: AuditRow[]): { golden: GoldenSet; summary: Summary } {
  const summary: Summary = {
    acceptCount: 0,
    acceptHighlyCount: 0,
    rejectCount: 0,
    commentCount: 0,
    emptyCount: 0,
    queriesAffected: new Set(),
  }

  const byId = new Map(golden.queries.map((q) => [q.id, q]))

  for (const row of rows) {
    const q = byId.get(row.queryId)
    if (!q) {
      console.warn(`[apply] Query ${row.queryId} não existe no golden; pulando`)
      continue
    }
    switch (row.decision) {
      case '':
        summary.emptyCount++
        break
      case 'reject':
        summary.rejectCount++
        break
      case 'comment':
        summary.commentCount++
        console.log(`[apply] COMMENT ${row.queryId} / ${row.candidateId.slice(0, 8)}: ${row.decisionNote}`)
        break
      case 'accept':
        q.annotations = addToAnnotations(q.annotations, row.candidateId, 'relevant')
        summary.acceptCount++
        summary.queriesAffected.add(row.queryId)
        break
      case 'accept-highly':
        q.annotations = addToAnnotations(q.annotations, row.candidateId, 'highly')
        summary.acceptHighlyCount++
        summary.queriesAffected.add(row.queryId)
        break
    }
  }

  // Atualiza annotatedAt das queries tocadas
  const stamp = new Date().toISOString()
  for (const q of golden.queries) {
    if (summary.queriesAffected.has(q.id)) {
      q.annotations.annotatedAt = stamp
      q.annotations.notes = [q.annotations.notes, '[Fase 6B — audit]'].filter(Boolean).join(' ')
    }
  }

  return { golden, summary }
}

async function main() {
  const { csvPath, apply } = parseArgs()

  console.log(`[apply] Lendo CSV: ${csvPath}`)
  const csvContent = readFileSync(csvPath, 'utf8')
  const rows = parseAuditCSV(csvContent)
  console.log(`[apply] ${rows.length} linhas`)

  const golden: GoldenSet = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))
  const { golden: updated, summary } = applyDecisions(golden, rows)

  console.log('[apply] Resumo:')
  console.log(`  accept:         ${summary.acceptCount}`)
  console.log(`  accept-highly:  ${summary.acceptHighlyCount}`)
  console.log(`  reject:         ${summary.rejectCount}`)
  console.log(`  comment:        ${summary.commentCount}`)
  console.log(`  empty:          ${summary.emptyCount}`)
  console.log(`  queries afetadas: ${summary.queriesAffected.size}`)

  if (summary.emptyCount > 0) {
    console.log(`⚠ ${summary.emptyCount} linhas sem decision. Revisar antes de --apply.`)
  }

  if (!apply) {
    console.log('\n[apply] DRY-RUN. Nenhum arquivo modificado. Rode com --apply para persistir.')
    return
  }

  // Backup
  const bakPath = `${GOLDEN_PATH}.bak-${new Date().toISOString().slice(0, 10)}`
  copyFileSync(GOLDEN_PATH, bakPath)
  console.log(`[apply] Backup: ${bakPath}`)

  writeFileSync(GOLDEN_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8')
  console.log(`[apply] ✓ golden-set.json atualizado`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[apply] FAILED:', err)
    process.exit(1)
  })
