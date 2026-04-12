/**
 * Gera golden set a partir do ementario ELIC.
 *
 * Uso:
 *   npx tsx eval/scripts/generate-golden-from-ementario.ts <caminho-acervo> [--dry-run]
 *
 * Etapas:
 *   1. Extrai teses e parseia fundamentos (extract-theses.ts)
 *   2. Resolve fundamentos contra o banco do sitedobarral (resolve-fundamentos.ts)
 *   3. Monta golden set entries e roda busca para candidatos
 *   4. Gera relatorio de candidatos para revisao humana
 */
import 'dotenv/config'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { extractTheses } from './extract-theses'
import { resolveAllFundamentos } from './resolve-fundamentos'
import { baselineSearch } from '../search-adapter'
import type { GoldenSet, GoldenQuery } from '../types'

const GOLDEN_PATH = join(process.cwd(), 'eval/golden-set.json')

async function main() {
  const args = process.argv.slice(2).filter(a => a !== '--dry-run')
  const dryRun = process.argv.includes('--dry-run')

  if (args.length === 0) {
    console.error('Uso: npx tsx eval/scripts/generate-golden-from-ementario.ts <caminho-acervo> [--dry-run]')
    process.exit(1)
  }

  const acervoDir = args[0]
  console.log('=== Etapa 1: Extracao de teses ===')
  const theses = extractTheses(acervoDir)
  console.log(`  ${theses.length} teses extraidas (${theses.filter(t => t.source === 'transversal').length} transversais, ${theses.filter(t => t.source === 'especifica').length} especificas)`)

  if (dryRun) {
    console.log('\n=== Etapa 2: Resolucao de fundamentos (PULADA — dry-run) ===')
    console.log('\n=== Etapa 3: Montagem do golden set (PULADA — dry-run) ===')
    console.log(`\n  ${theses.length} queries seriam geradas`)
    console.log('\n(dry-run: nao grava arquivos, nao acessa banco)')
    process.exit(0)
  }

  console.log('\n=== Etapa 2: Resolucao de fundamentos ===')
  const allRefs = theses.flatMap(t => t.fundamentos_parsed)
  const refMap = await resolveAllFundamentos(allRefs)

  console.log('\n=== Etapa 3: Montagem do golden set ===')
  const newQueries: GoldenQuery[] = []
  const candidatesReport: string[] = []
  candidatesReport.push('# Candidatos para revisao — Golden Set Ementario ELIC\n')
  candidatesReport.push(`Gerado em: ${new Date().toISOString()}\n`)
  candidatesReport.push('Documentos retornados pela busca que NAO estao nos fundamentos curados.')
  candidatesReport.push('O coordenador deve classificar cada um como relevante ou ruido.\n')

  for (const thesis of theses) {
    // Resolve fundamentos to documentIds
    const resolvedIds = new Set<string>()
    const resolvedDetails: Record<string, string> = {}
    const notFoundRefs: string[] = []

    for (const ref of thesis.fundamentos_parsed) {
      const resolved = refMap.get(ref.raw)
      if (resolved?.documentId) {
        resolvedIds.add(resolved.documentId)
        resolvedDetails[ref.raw] = resolved.documentId
      } else if (ref.type !== 'lei') {
        notFoundRefs.push(ref.raw)
      }
    }

    const highlyRelevant = [...resolvedIds]
    const relevant = [...resolvedIds]

    // Run search to find candidates
    let candidates: Array<{ id: string; title: string }> = []
    if (resolvedIds.size > 0) {
      try {
        const { documentIds } = await baselineSearch(thesis.query)
        const top10 = documentIds.slice(0, 10)
        candidates = top10
          .filter(id => !resolvedIds.has(id))
          .map(id => ({ id, title: '(titulo a preencher na revisao)' }))
      } catch {
        // Search failed — skip candidates
      }
    }

    const notes = [
      `Fundamentos curados: ${thesis.fundamentos_raw.join('; ')}`,
      notFoundRefs.length > 0 ? `Nao encontrados no indice: ${notFoundRefs.join('; ')}` : null,
      candidates.length > 0 ? `Candidatos pendentes de revisao: ${candidates.length}` : null,
    ].filter(Boolean).join('. ')

    const entry: any = {
      id: thesis.id,
      query: thesis.query,
      description: thesis.description,
      category: thesis.category,
      difficulty: thesis.difficulty,
      annotations: {
        relevant,
        highlyRelevant,
        annotatedAt: relevant.length > 0 ? new Date().toISOString() : null,
        annotatedBy: relevant.length > 0 ? 'elic-import' : null,
        notes,
      },
      _elic: {
        source: thesis.source,
        code: thesis.code,
        templateId: thesis.templateId,
        enunciado: thesis.enunciado,
        fundamentos_resolved: resolvedDetails,
        fundamentos_not_found: notFoundRefs,
        candidates_pending_review: candidates.map(c => c.id),
      },
    }

    newQueries.push(entry)

    // Append to candidates report if there are candidates
    if (candidates.length > 0) {
      candidatesReport.push(`\n## ${thesis.id}: ${thesis.query.slice(0, 60)}\n`)
      candidatesReport.push(`Tese: ${thesis.enunciado.slice(0, 120)}...\n`)
      candidatesReport.push('| # | Document ID | Acao |')
      candidatesReport.push('|---|---|---|')
      for (const c of candidates) {
        candidatesReport.push(`| | \`${c.id}\` | relevante / ruido |`)
      }
    }
  }

  // Stats
  const annotated = newQueries.filter(q => q.annotations.relevant.length > 0).length
  const unannotated = newQueries.length - annotated
  console.log(`  ${newQueries.length} queries geradas (${annotated} com anotacoes, ${unannotated} sem documentos resolvidos)`)

  // Merge with existing golden set
  const existing: GoldenSet = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))
  const existingIds = new Set(existing.queries.map(q => q.id))
  const toAdd = newQueries.filter(q => !existingIds.has(q.id))

  const merged: GoldenSet = {
    version: 2,
    createdAt: existing.createdAt,
    queries: [...existing.queries, ...toAdd],
  } as any

  writeFileSync(GOLDEN_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  console.log(`\n  golden-set.json atualizado: ${existing.queries.length} existentes + ${toAdd.length} novas = ${merged.queries.length} total`)

  // Write candidates report
  const reportsDir = join(process.cwd(), 'eval/reports')
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = join(reportsDir, 'ementario-candidates.md')
  writeFileSync(reportPath, candidatesReport.join('\n') + '\n', 'utf8')
  console.log(`  Relatorio de candidatos: eval/reports/ementario-candidates.md`)

  process.exit(0)
}

main().catch(err => {
  console.error('Falha:', err)
  process.exit(1)
})
