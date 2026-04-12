# Golden Set from Ementario ELIC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate ~79 annotated search queries from the curated ELIC thesis bank and import them into the sitedobarral eval golden set, using cited legal references as pre-validated relevance annotations.

**Architecture:** A single script reads ELIC's banco.json + 23 fichas, extracts queries from thesis enunciados, resolves cited fundamentos to documentIds via exact match (acordaoNumero/onNumber) then semantic fallback, assembles golden set entries compatible with the existing eval framework, and produces a candidates report for human review.

**Tech Stack:** TypeScript, tsx, Prisma (sitedobarral), hybridSearch adapter, existing eval types.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `eval/scripts/extract-theses.ts` | Create | Etapa 1: read ELIC sources, select theses, parse fundamentos, generate queries |
| `eval/scripts/resolve-fundamentos.ts` | Create | Etapa 2: correlate parsed references to documentIds via DB + search |
| `eval/scripts/generate-golden-from-ementario.ts` | Create | Etapa 3: orchestrator — runs extract + resolve + assemble + report |
| `eval/golden-set.json` | Modify | Merge new queries with existing 12 |
| `eval/reports/ementario-candidates.md` | Create | Candidates report for human review |

---

### Task 1: Extract theses and parse fundamentos

**Files:**
- Create: `eval/scripts/extract-theses.ts`

- [ ] **Step 1: Create the extraction module**

Create `eval/scripts/extract-theses.ts`:

```typescript
/**
 * Etapa 1: le banco.json + fichas ELIC, seleciona teses, parseia fundamentos.
 * Exporta funcoes puras (sem I/O de banco) para facilitar teste.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface ParsedReference {
  raw: string
  type: 'acordao_tcu' | 'sumula_tcu' | 'on_agu' | 'parecer' | 'decreto' | 'in' | 'lei' | 'outro'
  numero?: number
  ano?: number
}

export interface ExtractedThesis {
  id: string
  query: string
  enunciado: string
  description: string
  source: 'transversal' | 'especifica'
  code: string | null
  templateId: string | null
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  fundamentos_raw: string[]
  fundamentos_parsed: ParsedReference[]
}

/**
 * Parseia o campo fundamento de uma tese em referencias individuais.
 * Separadores: ";" no nivel principal.
 */
export function parseFundamentos(fundamento: string): ParsedReference[] {
  const refs: ParsedReference[] = []
  const parts = fundamento.split(';').map(s => s.trim()).filter(Boolean)

  for (const part of parts) {
    const ref: ParsedReference = { raw: part, type: 'outro' }

    // Acordao TCU: "Acordao 597/2023-Plenario" ou "TCU, Acordao 1351/2025-Plenario"
    const acordaoMatch = part.match(/Ac[oó]rd[aã]o\s+(\d+)\/(\d{4})/i)
    if (acordaoMatch) {
      ref.type = 'acordao_tcu'
      ref.numero = parseInt(acordaoMatch[1])
      ref.ano = parseInt(acordaoMatch[2])
      refs.push(ref)
      continue
    }

    // Sumula TCU: "Sumula TCU no 254"
    const sumulaMatch = part.match(/S[uú]mula\s+TCU\s+n[ºo°]\s*(\d+)/i)
    if (sumulaMatch) {
      ref.type = 'sumula_tcu'
      ref.numero = parseInt(sumulaMatch[1])
      refs.push(ref)
      continue
    }

    // ON AGU: "Orientacao Normativa AGU no 52/2014"
    const onMatch = part.match(/Orienta[cç][aã]o\s+Normativa\s+AGU\s+n[ºo°]\s*(\d+)\/(\d{4})/i)
    if (onMatch) {
      ref.type = 'on_agu'
      ref.numero = parseInt(onMatch[1])
      ref.ano = parseInt(onMatch[2])
      refs.push(ref)
      continue
    }

    // Parecer: "Parecer 63/2024/DECOR" ou "Parecer no 4/2022/CNMLC"
    const parecerMatch = part.match(/Parecer\s+(?:n[ºo°]\s*)?(\d+)\/(\d{4})/i)
    if (parecerMatch) {
      ref.type = 'parecer'
      ref.numero = parseInt(parecerMatch[1])
      ref.ano = parseInt(parecerMatch[2])
      refs.push(ref)
      continue
    }

    // Decreto: "Decreto 11.462/2023"
    const decretoMatch = part.match(/Decreto\s+(?:n[ºo°]\s*)?[\d.]+\/(\d{4})/i)
    if (decretoMatch) {
      ref.type = 'decreto'
      refs.push(ref)
      continue
    }

    // IN: "IN SEGES/ME no 65/2021"
    const inMatch = part.match(/(?:IN|Instru[cç][aã]o\s+Normativa)\s+/i)
    if (inMatch) {
      ref.type = 'in'
      refs.push(ref)
      continue
    }

    // Lei: "Lei 14.133/2021" or "Lei Complementar no 101/2000"
    const leiMatch = part.match(/Lei\s+(?:Complementar\s+)?(?:n[ºo°]\s*)?[\d.]+\/\d{4}/i)
    if (leiMatch) {
      ref.type = 'lei'
      refs.push(ref)
      continue
    }

    refs.push(ref)
  }

  return refs
}

/**
 * Gera query de busca a partir do enunciado de uma tese.
 * Extrai termos-chave, remove conectivos longos, limita a ~15 palavras.
 */
export function enunciadoToQuery(enunciado: string): string {
  return enunciado
    .replace(/\.$/, '')
    // Remove clausulas subordinadas longas entre virgulas
    .replace(/,\s*(?:nos termos|conforme|observad[ao]s|de acordo com|na forma d[ao]|salvo)[^,;.]*/gi, '')
    .replace(/,\s*(?:bem como|inclusive|especialmente)[^,;.]*/gi, '')
    // Remove artigos e preposicoes iniciais
    .replace(/^(?:A |O |As |Os |É |São )/i, '')
    // Trunca a ~100 chars e pega ate a ultima palavra completa
    .slice(0, 120)
    .replace(/\s+\S*$/, '')
    .trim()
}

/**
 * Estima dificuldade da query com base no tipo de fundamentos.
 */
export function estimateDifficulty(parsed: ParsedReference[]): 'easy' | 'medium' | 'hard' {
  const hasLei = parsed.some(r => r.type === 'lei')
  const hasJurisp = parsed.some(r => ['acordao_tcu', 'sumula_tcu', 'on_agu', 'parecer'].includes(r.type))

  if (hasLei && !hasJurisp) return 'easy'
  if (hasJurisp) return 'medium'
  return 'hard'
}

/**
 * Conta tipos distintos de fundamentos (para selecao de teses especificas).
 */
function fundamenoDiversity(parsed: ParsedReference[]): number {
  return new Set(parsed.map(r => r.type)).size
}

interface BancoTese {
  enunciado: string
  fundamento: string
  consequencia: string
  aplicavel_a: string[]
}

interface FichaTese {
  enunciado: string
  fundamento: string
  consequencia: string
}

interface Ficha {
  id: string
  nome_resumido: string
  teses_especificas: FichaTese[]
}

/**
 * Le o acervo ELIC e retorna as teses selecionadas (33 transversais + ~2 por template).
 */
export function extractTheses(acervoDir: string): ExtractedThesis[] {
  const result: ExtractedThesis[] = []

  // 1. Transversais (todas)
  const bancoPath = join(acervoDir, 'teses', 'banco.json')
  const banco = JSON.parse(readFileSync(bancoPath, 'utf8'))
  const teses: Record<string, BancoTese> = banco.teses

  for (const [code, tese] of Object.entries(teses)) {
    const parsed = parseFundamentos(tese.fundamento)
    result.push({
      id: code.toLowerCase(),
      query: enunciadoToQuery(tese.enunciado),
      enunciado: tese.enunciado,
      description: `Tese transversal ${code}: ${tese.enunciado.slice(0, 100)}...`,
      source: 'transversal',
      code,
      templateId: null,
      category: 'tese-transversal',
      difficulty: estimateDifficulty(parsed),
      fundamentos_raw: tese.fundamento.split(';').map(s => s.trim()).filter(Boolean),
      fundamentos_parsed: parsed,
    })
  }

  // 2. Especificas (top 2 por template por diversidade de fundamentos)
  const templatesDir = join(acervoDir, 'templates')
  const dirs = readdirSync(templatesDir).filter(d =>
    statSync(join(templatesDir, d)).isDirectory()
  )

  for (const dir of dirs) {
    const id = dir.split(' - ')[0]
    const fichaPath = join(templatesDir, dir, `${id}.json`)
    let ficha: Ficha
    try {
      ficha = JSON.parse(readFileSync(fichaPath, 'utf8'))
    } catch {
      continue
    }

    if (!ficha.teses_especificas || ficha.teses_especificas.length === 0) continue

    // Rank by fundamento diversity, then by enunciado length (shorter = more focused query)
    const ranked = ficha.teses_especificas
      .map((t, idx) => {
        const parsed = parseFundamentos(t.fundamento)
        return { t, idx, parsed, diversity: fundamenoDiversity(parsed), len: t.enunciado.length }
      })
      .sort((a, b) => b.diversity - a.diversity || a.len - b.len)
      .slice(0, 2)

    for (const { t, idx, parsed } of ranked) {
      const teseId = `esp-${id}-${idx}`
      result.push({
        id: teseId,
        query: enunciadoToQuery(t.enunciado),
        enunciado: t.enunciado,
        description: `Tese especifica do template ${id} (${ficha.nome_resumido}): ${t.enunciado.slice(0, 80)}...`,
        source: 'especifica',
        code: null,
        templateId: id,
        category: 'tese-especifica',
        difficulty: estimateDifficulty(parsed),
        fundamentos_raw: t.fundamento.split(';').map(s => s.trim()).filter(Boolean),
        fundamentos_parsed: parsed,
      })
    }
  }

  return result
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "C:/Projeto de site do Barral/sitedobarral" && npx tsx -e "import { extractTheses } from './eval/scripts/extract-theses'; const t = extractTheses('F:/OneDrive - AGU/Elic - projeto uniformização'); console.log('Extracted:', t.length, 'theses'); console.log('Sample query:', t[0].query); console.log('Sample refs:', t[0].fundamentos_parsed.length)"`

Expected: ~79 theses extracted, sample query printed.

- [ ] **Step 3: Commit**

```bash
cd "C:/Projeto de site do Barral/sitedobarral"
git add eval/scripts/extract-theses.ts
git commit -m "feat(eval): thesis extraction and fundamento parsing from ELIC ementario"
```

---

### Task 2: Resolve fundamentos to document IDs

**Files:**
- Create: `eval/scripts/resolve-fundamentos.ts`

- [ ] **Step 1: Create the resolution module**

Create `eval/scripts/resolve-fundamentos.ts`:

```typescript
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
    // Build a search substring from the raw reference
    const searchTerm = ref.raw
      .replace(/,\s*art\..*$/i, '')   // Remove article references
      .replace(/,\s*de\s+aplicação.*$/i, '') // Remove trailing clauses
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "C:/Projeto de site do Barral/sitedobarral" && npx tsx -e "import './eval/scripts/resolve-fundamentos'; console.log('OK')"`

Expected: prints "OK" (no syntax errors).

- [ ] **Step 3: Commit**

```bash
cd "C:/Projeto de site do Barral/sitedobarral"
git add eval/scripts/resolve-fundamentos.ts
git commit -m "feat(eval): resolve ELIC fundamento references to sitedobarral document IDs"
```

---

### Task 3: Orchestrator script and report generator

**Files:**
- Create: `eval/scripts/generate-golden-from-ementario.ts`

- [ ] **Step 1: Create the orchestrator**

Create `eval/scripts/generate-golden-from-ementario.ts`:

```typescript
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
        // Leis puras nao sao documentos indexados — nao contar como not_found
        notFoundRefs.push(ref.raw)
      }
    }

    const highlyRelevant = [...resolvedIds]
    const relevant = [...resolvedIds]

    // Run search to find candidates
    let candidates: Array<{ id: string; title: string }> = []
    if (!dryRun && resolvedIds.size > 0) {
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

    const entry: GoldenQuery & { _elic?: unknown } = {
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
    }

    // Rastreabilidade (campo extra ignorado pelo runner)
    ;(entry as any)._elic = {
      source: thesis.source,
      code: thesis.code,
      templateId: thesis.templateId,
      enunciado: thesis.enunciado,
      fundamentos_resolved: resolvedDetails,
      fundamentos_not_found: notFoundRefs,
      candidates_pending_review: candidates.map(c => c.id),
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

  if (dryRun) {
    console.log('\n(dry-run: nao grava arquivos)')
    process.exit(0)
  }

  // Merge with existing golden set
  const existing: GoldenSet = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))
  const existingIds = new Set(existing.queries.map(q => q.id))
  const toAdd = newQueries.filter(q => !existingIds.has(q.id))

  const merged: GoldenSet = {
    version: 2,
    createdAt: existing.createdAt,
    queries: [...existing.queries, ...toAdd],
  }

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
```

- [ ] **Step 2: Verify it compiles (dry-run)**

Run: `cd "C:/Projeto de site do Barral/sitedobarral" && npx tsx eval/scripts/generate-golden-from-ementario.ts "F:/OneDrive - AGU/Elic - projeto uniformização" --dry-run`

Expected: prints thesis count, resolution stats, and "(dry-run: nao grava arquivos)".

- [ ] **Step 3: Commit**

```bash
cd "C:/Projeto de site do Barral/sitedobarral"
git add eval/scripts/generate-golden-from-ementario.ts
git commit -m "feat(eval): golden set generator from ELIC ementario with candidate report"
```

---

### Task 4: Run the full pipeline and generate baseline

**Files:**
- Modify: `eval/golden-set.json`
- Create: `eval/reports/ementario-candidates.md`

- [ ] **Step 1: Run the generator for real**

Run: `cd "C:/Projeto de site do Barral/sitedobarral" && npx tsx eval/scripts/generate-golden-from-ementario.ts "F:/OneDrive - AGU/Elic - projeto uniformização"`

Expected: golden-set.json updated with ~91 queries (12 existing + ~79 new), candidates report generated.

- [ ] **Step 2: Verify golden set structure**

Run: `cd "C:/Projeto de site do Barral/sitedobarral" && node -e "const g=JSON.parse(require('fs').readFileSync('eval/golden-set.json','utf8')); console.log('Version:', g.version); console.log('Total queries:', g.queries.length); const ann=g.queries.filter(q=>q.annotations.relevant.length>0); console.log('Annotated:', ann.length); console.log('Unannotated:', g.queries.length-ann.length)"`

Expected: Version 2, ~91 queries, some annotated (those with resolved fundamentos).

- [ ] **Step 3: Run baseline eval**

Run: `cd "C:/Projeto de site do Barral/sitedobarral" && npx tsx eval/cli/run-baseline.ts --label "ementario-v1"`

Expected: eval report with recall@5, MRR, nDCG@10 for the annotated queries.

- [ ] **Step 4: Commit results**

```bash
cd "C:/Projeto de site do Barral/sitedobarral"
git add eval/golden-set.json eval/reports/
git commit -m "feat(eval): import 79 ELIC thesis queries into golden set, baseline run"
```

- [ ] **Step 5: Push**

```bash
git push
```
