# Fase 6 — Golden Set Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Executar auditoria do golden set em 3 sub-fases (6A casos conhecidos → 6B auditoria das 43 restantes → 6C re-eval + fechamento), atingindo recall@5 ≥ 48% sem tocar em retrieval.

**Architecture:** Novo módulo `eval/scripts/golden-audit/` com tipos + helpers puros (golden-ops, heurística de audit, CSV audit), hardcoded list de 8 E operations; 3 CLIs one-shot (`fase6a-apply-known.ts`, `annotation-audit.ts`, `fase6b-apply-audit.ts`) que orquestram as sub-fases. Reusa `failure-analysis/key-terms.ts` + `db-signals.ts` da Fase 0. 6A e 6B têm checkpoints humanos de revisão interativa/CSV.

**Tech Stack:** TypeScript, Node ≥ 20, tsx, Vitest, Prisma (Neon Postgres), `@inquirer/prompts` (interatividade no 6A — já usado em `eval/cli/annotate.ts`).

**Spec:** `docs/superpowers/specs/2026-04-23-fase6-golden-set-audit-design.md`

---

## File Structure

**Novos (em `eval/scripts/golden-audit/`):**
- `types.ts` — `GoldenOp`, `AuditCandidate`, `AuditRow`, `DecisionValue`.
- `golden-ops.ts` — funções puras para mutar `GoldenQuery.annotations` (add/remove, com dedup).
- `heuristic.ts` — `classifyCandidate(candidate, keyTerms): "accept" | "maybe" | "reject"`.
- `csv-audit.ts` — `formatAuditCSV(rows)` + `parseAuditCSV(content): ParsedRow[]`.
- `known-operations.ts` — const `KNOWN_OPERATIONS`: 8 E + 2 fantasma + placeholder dedup.

**Novos CLIs (em `eval/scripts/`):**
- `fase6a-apply-known.ts` — one-shot, interativo.
- `annotation-audit.ts` — gera CSV de sugestões.
- `fase6b-apply-audit.ts` — aplica CSV ao golden.

**Testes (em `lib/__tests__/eval/golden-audit/`):**
- `golden-ops.test.ts`
- `heuristic.test.ts`
- `csv-audit.test.ts`

**Modificações:**
- `eval/golden-set.json` — editado em 6A (1 commit) e 6B (1 commit). Backup `.bak` automático antes de 6B.
- `docs/ROADMAP_BUSCA_QUALIDADE.md` — atualizado em 6C.

**Entregáveis finais (commitados em runs separados):**
- `eval/reports/annotation-audit-2026-04-23.csv` — output de 6B passo 1.
- `eval/reports/<stamp>_pos-fase6.{md,json}` — eval re-run.
- `eval/reports/fase6-summary-2026-04-23.md` — resumo de 6C.

---

## Task 1: Tipos compartilhados do módulo golden-audit

**Files:**
- Create: `eval/scripts/golden-audit/types.ts`

- [ ] **Step 1: Criar arquivo**

```typescript
/**
 * Tipos do módulo de auditoria do golden set (Fase 6).
 */

/** Nome de lista onde um doc pode entrar. */
export type AnnotationList = 'relevant' | 'highly'

/** Operação declarativa aplicada a uma query do golden. */
export interface GoldenOp {
  /** Adicionar ID em `relevant` e, se `list === 'highly'`, em `highlyRelevant` também. */
  addId: (args: { id: string; list: AnnotationList }) => void
  /** Remover ID de ambos os arrays. */
  removeId: (args: { id: string }) => void
}

/** Linha bruta do CSV de auditoria (6B passo 1). */
export interface AuditCandidate {
  queryId: string
  queryText: string
  candidateId: string
  candidateTitle: string
  candidatePosition: number // 1-indexed no top-N
  candidateSnippet: string
  existingRelevantsCount: number
  suggestAuto: 'accept' | 'maybe' | 'reject'
}

/** Valores válidos pra coluna `decision` do CSV. */
export type DecisionValue = '' | 'accept' | 'accept-highly' | 'reject' | 'comment'

/** Linha do CSV após parsing (com decisão humana). */
export interface AuditRow extends AuditCandidate {
  decision: DecisionValue
  decisionNote: string
}

/** Especificação declarativa de uma operação conhecida em 6A. */
export interface KnownOperation {
  queryId: string
  /** Adições por busca de título no DB (fuzzy). Resolvidas em runtime. */
  addByTitle: Array<{ titleQuery: string; list: AnnotationList }>
  /** Adições com ID conhecido (dedup, casos de ID já sabido). */
  addById: Array<{ id: string; list: AnnotationList }>
  /** Remoções com ID conhecido (IDs fantasma, anotações erradas). */
  removeIds: string[]
  /** Descrição pra log/confirmação. */
  description: string
}
```

- [ ] **Step 2: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/golden-audit/types.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): tipos do módulo golden-audit (Fase 6)"
```

---

## Task 2: `golden-ops.ts` — mutações puras de GoldenQuery (TDD)

**Files:**
- Test: `lib/__tests__/eval/golden-audit/golden-ops.test.ts`
- Create: `eval/scripts/golden-audit/golden-ops.ts`

- [ ] **Step 1: Escrever teste falhando**

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addToAnnotations, removeFromAnnotations } from '@/eval/scripts/golden-audit/golden-ops'
import type { GoldenAnnotations } from '@/eval/types'

function baseAnn(overrides: Partial<GoldenAnnotations> = {}): GoldenAnnotations {
  return {
    relevant: ['a', 'b'],
    highlyRelevant: ['a'],
    annotatedAt: '2026-01-01T00:00:00Z',
    annotatedBy: 'test',
    notes: '',
    ...overrides,
  }
}

describe('addToAnnotations', () => {
  it('adiciona id em relevant quando list=relevant', () => {
    const ann = baseAnn()
    const out = addToAnnotations(ann, 'c', 'relevant')
    expect(out.relevant).toEqual(['a', 'b', 'c'])
    expect(out.highlyRelevant).toEqual(['a'])
  })

  it('adiciona em ambos quando list=highly', () => {
    const ann = baseAnn()
    const out = addToAnnotations(ann, 'c', 'highly')
    expect(out.relevant).toEqual(['a', 'b', 'c'])
    expect(out.highlyRelevant).toEqual(['a', 'c'])
  })

  it('não duplica id já presente em relevant', () => {
    const ann = baseAnn()
    const out = addToAnnotations(ann, 'b', 'relevant')
    expect(out.relevant).toEqual(['a', 'b'])
  })

  it('promove de relevant-only pra highly quando list=highly', () => {
    const ann = baseAnn() // 'b' está em relevant mas não highly
    const out = addToAnnotations(ann, 'b', 'highly')
    expect(out.relevant).toEqual(['a', 'b'])
    expect(out.highlyRelevant).toEqual(['a', 'b'])
  })

  it('não muta input', () => {
    const ann = baseAnn()
    const originalRelevant = [...ann.relevant]
    addToAnnotations(ann, 'c', 'relevant')
    expect(ann.relevant).toEqual(originalRelevant)
  })
})

describe('removeFromAnnotations', () => {
  it('remove id de relevant e highlyRelevant', () => {
    const ann = baseAnn()
    const out = removeFromAnnotations(ann, 'a')
    expect(out.relevant).toEqual(['b'])
    expect(out.highlyRelevant).toEqual([])
  })

  it('no-op para id inexistente', () => {
    const ann = baseAnn()
    const out = removeFromAnnotations(ann, 'zzz')
    expect(out.relevant).toEqual(['a', 'b'])
    expect(out.highlyRelevant).toEqual(['a'])
  })

  it('não muta input', () => {
    const ann = baseAnn()
    const originalRelevant = [...ann.relevant]
    removeFromAnnotations(ann, 'a')
    expect(ann.relevant).toEqual(originalRelevant)
  })
})
```

- [ ] **Step 2: Rodar — falha de módulo**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npm run test:run -- lib/__tests__/eval/golden-audit/golden-ops.test.ts
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```typescript
import type { GoldenAnnotations } from '../../types'
import type { AnnotationList } from './types'

/**
 * Retorna uma nova GoldenAnnotations com `id` adicionado em `relevant`
 * (sempre) e em `highlyRelevant` (se list === 'highly'). Sem duplicatas.
 * Não muta input.
 */
export function addToAnnotations(
  ann: GoldenAnnotations,
  id: string,
  list: AnnotationList
): GoldenAnnotations {
  const relevant = ann.relevant.includes(id) ? ann.relevant : [...ann.relevant, id]
  const highlyRelevant =
    list === 'highly' && !ann.highlyRelevant.includes(id)
      ? [...ann.highlyRelevant, id]
      : ann.highlyRelevant
  return { ...ann, relevant, highlyRelevant }
}

/**
 * Retorna uma nova GoldenAnnotations com `id` removido de ambos arrays.
 * Não muta input.
 */
export function removeFromAnnotations(
  ann: GoldenAnnotations,
  id: string
): GoldenAnnotations {
  return {
    ...ann,
    relevant: ann.relevant.filter((x) => x !== id),
    highlyRelevant: ann.highlyRelevant.filter((x) => x !== id),
  }
}
```

- [ ] **Step 4: Rodar — passa**

```bash
npm run test:run -- lib/__tests__/eval/golden-audit/golden-ops.test.ts
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/golden-audit/golden-ops.ts lib/__tests__/eval/golden-audit/golden-ops.test.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): mutações puras de GoldenAnnotations (golden-audit)"
```

---

## Task 3: `known-operations.ts` — lista declarativa dos 10 casos de 6A

**Files:**
- Create: `eval/scripts/golden-audit/known-operations.ts`

Não tem testes unitários — é dado declarativo. Será validado em runtime pelo script 6A.

- [ ] **Step 1: Criar arquivo**

```typescript
import type { KnownOperation } from './types'

/**
 * Operações pré-decididas em 2026-04-23 (ver spec:
 * docs/superpowers/specs/2026-04-23-fase6-golden-set-audit-design.md).
 *
 * Títulos em `addByTitle.titleQuery` são substrings usadas em LIKE contra
 * `Document.title` no banco. O script interativo confirma match antes de
 * aplicar.
 */
export const KNOWN_OPERATIONS: KnownOperation[] = [
  // ============ 8 queries E ============
  {
    queryId: 't-pesquisa-precos-in65-01',
    description: 'Adicionar IN 65/2021 (highly) + 2 Manuais TCU (relevant); manter ON 17/2009',
    addByTitle: [
      { titleQuery: 'IN SEGES/ME 65/2021', list: 'highly' },
      { titleQuery: 'Manual TCU - 4.3.9.1', list: 'relevant' },
      { titleQuery: 'Manual TCU - 4.3.9.3', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 't-eng-bdi-irpj-csll-01',
    description: 'Adicionar 5 Inf.s BDI/IRPJ/CSLL; Inf. 17/2010 em highly',
    addByTitle: [
      { titleQuery: 'Inf. 17/2010', list: 'highly' },
      { titleQuery: 'Inf. 12/2010', list: 'relevant' },
      { titleQuery: 'Inf. 44/2010', list: 'relevant' },
      { titleQuery: 'Inf. 279/2016', list: 'relevant' },
      { titleQuery: 'Inf. 222/2014', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 't-terceirizacao-art48-01',
    description: 'Adicionar Inf. 114/2012 (highly) + Inf. 345/2018 (relevant)',
    addByTitle: [
      { titleQuery: 'Inf. 114/2012', list: 'highly' },
      { titleQuery: 'Inf. 345/2018', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 'esp-518661-2',
    description: 'REMOVER ON AGU 2/2009 (anotação errada) + adicionar 5 docs remanescente de obra',
    addByTitle: [
      { titleQuery: 'Acórdão TCU 1498/2021', list: 'highly' },
      { titleQuery: 'Inf. 349/2018', list: 'relevant' },
      { titleQuery: 'Inf. 188/2014', list: 'relevant' },
      { titleQuery: 'Inf. 310/2016', list: 'relevant' },
      { titleQuery: 'Inf. 300/2016', list: 'relevant' },
    ],
    addById: [],
    removeIds: ['9add63a3'], // prefix; resolved to full UUID at runtime
  },
  {
    queryId: 'esp-669066-13',
    description: 'Adicionar 5 Inf.s adjudicação; 183/2014 e 237/2015 em highly',
    addByTitle: [
      { titleQuery: 'Inf. 183/2014', list: 'highly' },
      { titleQuery: 'Inf. 237/2015', list: 'highly' },
      { titleQuery: 'Inf. 173/2013', list: 'relevant' },
      { titleQuery: 'Inf. 216/2014', list: 'relevant' },
      { titleQuery: 'Inf. 250/2015', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 'esp-728449-12',
    description: 'Adicionar 2 Manuais TCU (highly) + 3 Inf.s orçamento (relevant)',
    addByTitle: [
      { titleQuery: 'Manual TCU - 4.4.3 Projeto Básico', list: 'highly' },
      { titleQuery: 'Manual TCU - 4.4.3.6 Orçamento detalhado', list: 'highly' },
      { titleQuery: 'Inf. 220/2014', list: 'relevant' },
      { titleQuery: 'Inf. 99/2012', list: 'relevant' },
      { titleQuery: 'Inf. 50/2011', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 'esp-792741-1',
    description: 'Adicionar Art. 125 + 2 Acórdãos (highly) + 2 Inf.s (relevant)',
    addByTitle: [
      { titleQuery: 'Art. 125 - Lei 14.133/2021', list: 'highly' },
      { titleQuery: 'Acórdão TCU 2391/2025', list: 'highly' },
      { titleQuery: 'Acórdão TCU 781/2021', list: 'highly' },
      { titleQuery: 'Inf. 516/2025', list: 'relevant' },
      { titleQuery: 'Inf. 476/2024', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 'esp-797806-1',
    description: 'Adicionar Art. 41 (highly) + Enunciados IBDA + Acórdão + Inf.',
    addByTitle: [
      { titleQuery: 'Art. 41 - Lei 14.133/2021', list: 'highly' },
      { titleQuery: 'Enunciado do IBDA nº 27', list: 'relevant' },
      { titleQuery: 'Enunciado do IBDA nº 5', list: 'relevant' },
      { titleQuery: 'Acórdão TCU 6875/2021', list: 'relevant' },
      { titleQuery: 'Inf. 413/2021', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },

  // ============ 2 IDs fantasma em q-data-a-data ============
  {
    queryId: 'q-data-a-data',
    description: 'Remover 2 IDs fantasma (docs inexistentes no DB)',
    addByTitle: [],
    addById: [],
    removeIds: [
      '96cbdacf-7387-4286-9529-f2aacc81e7d8',
      '097d3cdb-303b-40ec-b15b-e5ce70ae50ba',
    ],
  },

  // ============ dedup ON 89/2024 em esp-785767-20 ============
  // O ID duplicado é descoberto em runtime via spot-check SQL. O script
  // pergunta interativamente se aplica — este entry é placeholder.
]
```

- [ ] **Step 2: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/golden-audit/known-operations.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): lista declarativa de operações conhecidas da Fase 6A"
```

---

## Task 4: `fase6a-apply-known.ts` — CLI interativo que aplica 6A

**Files:**
- Create: `eval/scripts/fase6a-apply-known.ts`

Este é o CLI principal de 6A. Faz:
1. Dedup spot-check (SQL + filtragem por docs em anotações).
2. Interativo: confirma cada operação resolvendo títulos no DB.
3. Gera diff do golden-set.json.
4. Confirma save.

- [ ] **Step 1: Criar arquivo**

```typescript
/**
 * Sub-fase 6A do ROADMAP_BUSCA_QUALIDADE: aplica operações conhecidas
 * ao eval/golden-set.json.
 *
 * Uso:
 *   npx dotenv -e .env.local -- tsx eval/scripts/fase6a-apply-known.ts
 *
 * Interativo. Para cada operação em KNOWN_OPERATIONS:
 * - Resolve títulos no DB via LIKE.
 * - Mostra matches para o usuário e pede confirmação.
 * - Monta operações, aplica em memória.
 * - Ao final, mostra diff consolidado e pergunta se salva.
 *
 * Spot-check de dedup roda primeiro, antes das operações hardcoded.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { select, confirm, input } from '@inquirer/prompts'
import { prisma } from '@/lib/prisma'
import type { GoldenSet, GoldenQuery } from '../types'
import { KNOWN_OPERATIONS } from './golden-audit/known-operations'
import { addToAnnotations, removeFromAnnotations } from './golden-audit/golden-ops'
import type { KnownOperation } from './golden-audit/types'

const GOLDEN_PATH = join(process.cwd(), 'eval/golden-set.json')

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
  // Múltiplos matches — pedir seleção
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

async function resolveRemoveId(idPrefix: string): Promise<{ id: string; title: string | null } | null> {
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
    // Pode ser ID fantasma — retornar original pra remoção mesmo assim
    return { id: idPrefix, title: null }
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
    const proceed = await confirm({ message: 'Continuar e tratar só os casos óbvios (esp-785767-20)?', default: true })
    if (!proceed) return []
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
      const apply = await confirm({
        message: `  Query "${q.id}" tem ${overlap.length} ID(s) desse doc anotados. Adicionar o(s) duplicado(s) ${notInGolden.join(', ')} também?`,
        default: true,
      })
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

async function resolveKnownOperation(op: KnownOperation): Promise<ResolvedOp> {
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
    const resolved = await resolveRemoveId(idPrefix)
    if (resolved) removeIds.push({ id: resolved.id, previousTitle: resolved.title ?? undefined })
  }

  console.log(`  Resumo: ${addIds.length} adições + ${removeIds.length} remoções`)
  return { queryId: op.queryId, addIds, removeIds }
}

function applyResolvedOps(golden: GoldenSet, ops: ResolvedOp[]): GoldenSet {
  const byId = new Map(golden.queries.map((q) => [q.id, q]))
  const newQueries: GoldenQuery[] = golden.queries.map((q) => {
    const queryOps = ops.filter((op) => op.queryId === q.id)
    if (queryOps.length === 0) return q
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
        notes: [ann.notes, '[Fase 6A — 2026-04-23]'].filter(Boolean).join(' '),
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
    const resolved = await resolveKnownOperation(op)
    allOps.push(resolved)
  }

  // 3. Aplicar em memória
  const afterGolden = applyResolvedOps(golden, allOps)

  // 4. Mostrar diff
  console.log('\n=== DIFF consolidado ===')
  const diff = summarizeDiff(beforeSnapshot, afterGolden)
  console.log(diff || '(sem mudanças)')

  // 5. Confirmar save
  const save = await confirm({ message: '\nSalvar golden-set.json com essas mudanças?', default: false })
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
```

- [ ] **Step 2: Type-check**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "fase6a|golden-audit" | head -10
```

Expected: saída vazia.

- [ ] **Step 3: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/fase6a-apply-known.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): CLI fase6a-apply-known.ts (dedup + 10 casos conhecidos)"
```

---

## Task 5 [HUMAN CHECKPOINT]: Executar 6A interativamente

Este task depende de input humano para confirmar cada match de título e decisões de dedup. Subagent NÃO executa sozinho.

**Files:**
- Modify: `eval/golden-set.json` (via script)

- [ ] **Step 1: Rodar 6A**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- tsx eval/scripts/fase6a-apply-known.ts
```

**O humano deve:**
1. No spot-check de dedup: revisar pares duplicados flagados; confirmar (`y`) adição do ID duplicado em queries afetadas.
2. Para cada operação em KNOWN_OPERATIONS:
   - Se match único: o script aceita automaticamente.
   - Se múltiplos matches: escolher o correto via menu.
   - Se sem match: o script pula com warning.
3. Ao final, revisar DIFF impresso. Se OK, confirmar `y` pra salvar.

Expected: `golden-set.json` modificado; golden tem 34 adições, 1 remoção (`esp-518661-2` → ON 2/2009), 2 remoções fantasma (`q-data-a-data`), + N adições de dedup (dependendo do spot-check).

- [ ] **Step 2: Commit das mudanças**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/golden-set.json
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "fix(eval): reanotar 8 queries E + remover IDs fantasma + handle dedup ON 89/2024"
```

---

## Task 6: `heuristic.ts` — classificador de candidato (TDD)

**Files:**
- Test: `lib/__tests__/eval/golden-audit/heuristic.test.ts`
- Create: `eval/scripts/golden-audit/heuristic.ts`

- [ ] **Step 1: Escrever teste falhando**

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { classifyCandidate } from '@/eval/scripts/golden-audit/heuristic'

describe('classifyCandidate', () => {
  it('accept: top-5 e pelo menos 1 key-term bate em title', () => {
    expect(
      classifyCandidate({
        position: 3,
        candidateTitle: 'Acórdão TCU 2391/2025 - Aditivo - Limite',
        candidateContent: 'blah',
        keyTerms: ['2391/2025'],
      })
    ).toBe('accept')
  })

  it('accept: top-5 e key-term bate em content', () => {
    expect(
      classifyCandidate({
        position: 1,
        candidateTitle: 'Inf. ruim',
        candidateContent: 'artigo 125 da Lei 14.133/2021 aplica-se',
        keyTerms: ['14.133/2021', 'art. 125'],
      })
    ).toBe('accept')
  })

  it('maybe: top-5 sem match de key-term', () => {
    expect(
      classifyCandidate({
        position: 4,
        candidateTitle: 'Inf. sobre algo',
        candidateContent: 'texto qualquer',
        keyTerms: ['14.133/2021'],
      })
    ).toBe('maybe')
  })

  it('maybe: top-6..10 com match de key-term', () => {
    expect(
      classifyCandidate({
        position: 8,
        candidateTitle: 'Inf. sobre 14.133/2021',
        candidateContent: 'blah',
        keyTerms: ['14.133/2021'],
      })
    ).toBe('maybe')
  })

  it('reject: top-6..10 sem match de key-term', () => {
    expect(
      classifyCandidate({
        position: 8,
        candidateTitle: 'Inf. genérico',
        candidateContent: 'texto',
        keyTerms: ['14.133/2021'],
      })
    ).toBe('reject')
  })

  it('maybe: query sem key-terms extraídos e candidato em top-5', () => {
    // Quando keyTerms está vazio, não há como bater — cai em maybe pra top-5
    expect(
      classifyCandidate({
        position: 2,
        candidateTitle: 'qualquer',
        candidateContent: 'conteúdo',
        keyTerms: [],
      })
    ).toBe('maybe')
  })

  it('reject: query sem key-terms e top-6+', () => {
    expect(
      classifyCandidate({
        position: 7,
        candidateTitle: 'qualquer',
        candidateContent: 'conteúdo',
        keyTerms: [],
      })
    ).toBe('reject')
  })
})
```

- [ ] **Step 2: Rodar — falha**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npm run test:run -- lib/__tests__/eval/golden-audit/heuristic.test.ts
```

- [ ] **Step 3: Implementar**

```typescript
import { matchKeyTermsInText } from '../failure-analysis/key-terms'

/**
 * Classifica um candidato à anotação como "accept" | "maybe" | "reject"
 * com base em posição no ranking e overlap de key-terms.
 *
 * Regras:
 * - position ≤ 5 E algum key-term bate em title OU content → accept
 * - position ≤ 5 sem match (OU sem key-terms extraídos) → maybe
 * - position 6..10 E algum key-term bate → maybe
 * - senão → reject
 */
export function classifyCandidate(args: {
  position: number
  candidateTitle: string
  candidateContent: string
  keyTerms: string[]
}): 'accept' | 'maybe' | 'reject' {
  const { position, candidateTitle, candidateContent, keyTerms } = args
  const hasKeyTerms = keyTerms.length > 0
  const titleHits = matchKeyTermsInText(keyTerms, candidateTitle)
  const contentHits = matchKeyTermsInText(keyTerms, candidateContent)
  const anyMatch = Object.values({ ...titleHits, ...contentHits }).some(Boolean)

  if (position <= 5) {
    if (hasKeyTerms && anyMatch) return 'accept'
    return 'maybe'
  }
  if (position <= 10) {
    if (hasKeyTerms && anyMatch) return 'maybe'
    return 'reject'
  }
  return 'reject'
}
```

- [ ] **Step 4: Rodar — passa**

```bash
npm run test:run -- lib/__tests__/eval/golden-audit/heuristic.test.ts
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/golden-audit/heuristic.ts lib/__tests__/eval/golden-audit/heuristic.test.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): heurística de audit (accept/maybe/reject) para golden-audit"
```

---

## Task 7: `csv-audit.ts` — format + parse do CSV de auditoria (TDD)

**Files:**
- Test: `lib/__tests__/eval/golden-audit/csv-audit.test.ts`
- Create: `eval/scripts/golden-audit/csv-audit.ts`

- [ ] **Step 1: Escrever teste falhando**

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { formatAuditCSV, parseAuditCSV } from '@/eval/scripts/golden-audit/csv-audit'
import type { AuditCandidate } from '@/eval/scripts/golden-audit/types'

function cand(overrides: Partial<AuditCandidate> = {}): AuditCandidate {
  return {
    queryId: 'q-1',
    queryText: 'teste',
    candidateId: 'doc-1',
    candidateTitle: 'Titulo',
    candidatePosition: 2,
    candidateSnippet: 'trecho',
    existingRelevantsCount: 3,
    suggestAuto: 'accept',
    ...overrides,
  }
}

describe('formatAuditCSV', () => {
  it('header + linhas com campo decision vazio', () => {
    const csv = formatAuditCSV([cand(), cand({ queryId: 'q-2' })])
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(3) // header + 2
    expect(lines[0]).toContain('decision')
    expect(lines[1]).toMatch(/,\s*$|,""$|accept,,$|accept,,\s*$/) // decision + decision_note vazios
  })

  it('escapa aspas/vírgulas em campos', () => {
    const csv = formatAuditCSV([cand({ queryText: 'a, "b" c' })])
    expect(csv).toContain('"a, ""b"" c"')
  })
})

describe('parseAuditCSV', () => {
  it('parseia CSV com decisões preenchidas', () => {
    const csv = `query_id,query_text,candidate_id,candidate_title,candidate_position,candidate_snippet,existing_relevants_count,suggest_auto,decision,decision_note
q-1,teste,doc-1,Titulo,2,trecho,3,accept,accept-highly,porque sim
q-2,outro,doc-2,Outro,5,snippet,1,reject,,
`
    const rows = parseAuditCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].queryId).toBe('q-1')
    expect(rows[0].decision).toBe('accept-highly')
    expect(rows[0].decisionNote).toBe('porque sim')
    expect(rows[1].decision).toBe('')
  })

  it('lida com aspas escapadas', () => {
    const csv = `query_id,query_text,candidate_id,candidate_title,candidate_position,candidate_snippet,existing_relevants_count,suggest_auto,decision,decision_note
q-1,"a, ""b"" c",doc,Titulo,1,snip,0,accept,accept,
`
    const rows = parseAuditCSV(csv)
    expect(rows[0].queryText).toBe('a, "b" c')
  })

  it('lança erro em decision inválida', () => {
    const csv = `query_id,query_text,candidate_id,candidate_title,candidate_position,candidate_snippet,existing_relevants_count,suggest_auto,decision,decision_note
q-1,teste,doc-1,Titulo,2,trecho,3,accept,foo,
`
    expect(() => parseAuditCSV(csv)).toThrow(/decision inválida/i)
  })
})
```

- [ ] **Step 2: Rodar — falha**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npm run test:run -- lib/__tests__/eval/golden-audit/csv-audit.test.ts
```

- [ ] **Step 3: Implementar**

```typescript
import type { AuditCandidate, AuditRow, DecisionValue } from './types'

const COLUMNS = [
  'query_id',
  'query_text',
  'candidate_id',
  'candidate_title',
  'candidate_position',
  'candidate_snippet',
  'existing_relevants_count',
  'suggest_auto',
  'decision',
  'decision_note',
] as const

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (/["\r\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function formatAuditCSV(rows: AuditCandidate[]): string {
  const lines: string[] = [COLUMNS.join(',')]
  for (const r of rows) {
    const values = [
      r.queryId,
      r.queryText,
      r.candidateId,
      r.candidateTitle,
      r.candidatePosition,
      r.candidateSnippet,
      r.existingRelevantsCount,
      r.suggestAuto,
      '', // decision — preenchido manualmente
      '', // decision_note
    ]
    lines.push(values.map(csvEscape).join(','))
  }
  return lines.join('\n') + '\n'
}

/** Parser tolerante de CSV com quoting RFC 4180. */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let i = 0
  let current = ''
  let inQuotes = false
  while (i < line.length) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      current += c
      i++
    } else {
      if (c === ',') {
        fields.push(current)
        current = ''
        i++
        continue
      }
      if (c === '"' && current === '') {
        inQuotes = true
        i++
        continue
      }
      current += c
      i++
    }
  }
  fields.push(current)
  return fields
}

const VALID_DECISIONS: DecisionValue[] = ['', 'accept', 'accept-highly', 'reject', 'comment']

export function parseAuditCSV(content: string): AuditRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return []
  const header = parseCSVLine(lines[0])
  if (header.join(',') !== COLUMNS.join(',')) {
    throw new Error(`Header do CSV não bate com o esperado.\nEsperado: ${COLUMNS.join(',')}\nRecebido: ${header.join(',')}`)
  }
  const rows: AuditRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.length !== COLUMNS.length) {
      throw new Error(`Linha ${i + 1} tem ${fields.length} colunas, esperado ${COLUMNS.length}`)
    }
    const decision = fields[8] as DecisionValue
    if (!VALID_DECISIONS.includes(decision)) {
      throw new Error(`Linha ${i + 1}: decision inválida "${decision}". Valores aceitos: ${VALID_DECISIONS.join(', ')}`)
    }
    rows.push({
      queryId: fields[0],
      queryText: fields[1],
      candidateId: fields[2],
      candidateTitle: fields[3],
      candidatePosition: parseInt(fields[4], 10),
      candidateSnippet: fields[5],
      existingRelevantsCount: parseInt(fields[6], 10),
      suggestAuto: fields[7] as 'accept' | 'maybe' | 'reject',
      decision,
      decisionNote: fields[9],
    })
  }
  return rows
}
```

- [ ] **Step 4: Rodar — passa**

```bash
npm run test:run -- lib/__tests__/eval/golden-audit/csv-audit.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/golden-audit/csv-audit.ts lib/__tests__/eval/golden-audit/csv-audit.test.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): format + parse do CSV de auditoria (golden-audit)"
```

---

## Task 8: `annotation-audit.ts` — CLI gerador do CSV

**Files:**
- Create: `eval/scripts/annotation-audit.ts`

- [ ] **Step 1: Criar arquivo**

```typescript
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
  const goldenById = new Map(golden.queries.map((q) => [q.id, q]))

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
```

- [ ] **Step 2: Type-check**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "annotation-audit|golden-audit" | head -10
```

Expected: saída vazia.

- [ ] **Step 3: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/annotation-audit.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): CLI annotation-audit.ts — gera CSV de candidatos (6B passo 1)"
```

---

## Task 9: `fase6b-apply-audit.ts` — CLI que aplica CSV ao golden

**Files:**
- Create: `eval/scripts/fase6b-apply-audit.ts`

- [ ] **Step 1: Criar arquivo**

```typescript
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
```

- [ ] **Step 2: Type-check**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "fase6b|golden-audit" | head -10
```

Expected: saída vazia.

- [ ] **Step 3: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/fase6b-apply-audit.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): CLI fase6b-apply-audit.ts — aplica CSV de audit ao golden (6B passo 2)"
```

---

## Task 10 [HUMAN CHECKPOINT]: Rodar audit + revisar CSV + aplicar

**Files:**
- Create: `eval/reports/annotation-audit-2026-04-23.csv`
- Modify: `eval/golden-set.json` (via script, após revisão)

- [ ] **Step 1: Gerar CSV**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- tsx eval/scripts/annotation-audit.ts \
  --from eval/reports/2026-04-23T12-46-32_diag-fase0.json \
  --skip-queries q-data-a-data,t-pesquisa-precos-in65-01,t-eng-bdi-irpj-csll-01,t-terceirizacao-art48-01,esp-518661-2,esp-669066-13,esp-728449-12,esp-792741-1,esp-797806-1,esp-785767-20 \
  --threshold 10
```

Expected: `eval/reports/annotation-audit-2026-04-23.csv` criado com ~225 linhas; distribuição impressa no stdout.

- [ ] **Step 2 [HUMAN]: Revisar CSV**

Abrir `eval/reports/annotation-audit-2026-04-23.csv` no editor (Excel/LibreOffice/VSCode). Para cada linha, preencher coluna `decision`:
- `accept` — adiciona candidato à lista `relevant`.
- `accept-highly` — adiciona a `relevant` E `highlyRelevant`.
- `reject` — não adiciona.
- `comment` — explicação livre no `decision_note` (não aplica mudança no golden).

Priorizar linhas com `suggest_auto=accept` ou `maybe`. Linhas com `suggest_auto=reject` geralmente têm decisão natural, mas revisar por amostragem.

Salvar o CSV quando completo (todas as linhas com `decision` preenchida).

- [ ] **Step 3: Dry-run da aplicação**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx dotenv -e .env.local -- tsx eval/scripts/fase6b-apply-audit.ts \
  --csv eval/reports/annotation-audit-2026-04-23.csv
```

Revisar resumo impresso: contagens de accept/accept-highly/reject/comment/empty fazem sentido? Se sim, seguir. Se não, voltar ao step 2 e corrigir CSV.

- [ ] **Step 4: Aplicar com `--apply`**

```bash
npx dotenv -e .env.local -- tsx eval/scripts/fase6b-apply-audit.ts \
  --csv eval/reports/annotation-audit-2026-04-23.csv --apply
```

Expected: `golden-set.json.bak-2026-04-23` criado; `golden-set.json` atualizado.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/golden-set.json eval/reports/annotation-audit-2026-04-23.csv
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "fix(eval): expandir anotações de 43 queries via auditoria de golden set"
```

---

## Task 11: Re-rodar eval com golden atualizado

**Files:**
- Create: `eval/reports/<stamp>_pos-fase6.{md,json}`

- [ ] **Step 1: Rodar eval**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npm run eval:run -- --label pos-fase6
```

Expected output:
- `[eval] 53 evaluated, 38 skipped (not annotated)` (ou menos skipped se 6A promoveu alguma anterior não-anotada — improvável).
- `[eval] recall@5=XX.X% mrr=0.XXX ndcg@10=0.XXX` (meta: ≥ 48%; mínimo aceito: > 40%).
- Se recall@5 regrediu vs 34.1%, PARAR e investigar. Improvável dado que operação é append-only; regressão só se remoção de `esp-518661-2` estiver errada.

- [ ] **Step 2: Commit artefatos do run**

```bash
STAMP=$(ls -1t eval/reports/*_pos-fase6.json | head -1 | sed 's|.*/||; s|_pos-fase6.json||')
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add "eval/reports/${STAMP}_pos-fase6.md" "eval/reports/${STAMP}_pos-fase6.json"
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "docs(eval): eval run pós-Fase 6 (golden set auditado)"
```

---

## Task 12: Gerar `fase6-summary-2026-04-23.md`

**Files:**
- Create: `eval/reports/fase6-summary-2026-04-23.md`

Este arquivo é **escrito manualmente** com base nos resultados observados (não tem script que gera automaticamente — estrutura conhecida, mas conteúdo depende dos números reais).

- [ ] **Step 1: Criar arquivo com template**

Criar `eval/reports/fase6-summary-2026-04-23.md` com o esqueleto:

```markdown
# Fase 6 — Summary (Auditoria do Golden Set)

**Data:** 2026-04-23
**Spec:** `docs/superpowers/specs/2026-04-23-fase6-golden-set-audit-design.md`

## Métricas antes/depois

| Métrica | Pré-Fase 6 (baseline Fase 0) | Pós-Fase 6 | Δ |
|---|---|---|---|
| recall@5 (avg) | 34.1% | X.X% | +X.Xpp |
| MRR | 0.352 | 0.XXX | +0.XXX |
| nDCG@10 (avg) | 0.367 | 0.XXX | +0.XXX |

Meta do spec: ≥ 48% recall@5. Status: [atingida | abaixo | muito abaixo].

## 6A — Casos conhecidos

- 8 queries E re-anotadas (adds + 1 remoção em esp-518661-2).
- 2 IDs fantasma removidos de q-data-a-data.
- Dedup: N pares encontrados; M aplicados defensivamente; resto registrado para Fase 7 [se aplicável].

## 6B — Auditoria das 43

- CSV gerado com N candidatos.
- Distribuição `suggest_auto`: accept=X, maybe=Y, reject=Z.
- Decisão final: accept=X, accept-highly=Y, reject=Z, comment=W.
- Queries afetadas: N/43.

## Observações sobre a distribuição nova

[Observar: o achado principal da Fase 0 foi 8 buckets E. Agora que golden foi corrigido,
qual seria a distribuição se re-rodássemos o diagnóstico? Rodar analyze-failures.ts
contra o pós-Fase 6 run daria essa resposta, mas é opcional — incluir aqui se quiser.]

## Recomendação para Fase 2 (rerank)

[Dado o novo baseline, a Fase 2 ainda faz sentido? Os 9 casos D+ devem ter ficado
com recall@5 ainda baixo (porque só passamos a incluir novos docs no relevant, não
mudamos o ranking). Provavelmente sim; mas medir antes de decidir.]

## Próximos passos

- [ ] Executar Fase 2 (cross-encoder rerank) com o golden auditado.
- [ ] Se dedup spot-check revelou > 15 pares, escalar Fase 7 no roadmap.
- [ ] Considerar criar queries novas (scope out desta fase) para atingir 150+ do roadmap original.
```

- [ ] **Step 2 [HUMAN]: Preencher com os números reais**

Pegar os números do output do Task 11 (recall@5, MRR, nDCG@10 do run `pos-fase6`). Ler o resumo impresso pelo `fase6b-apply-audit.ts` no Task 10 para as contagens de audit.

- [ ] **Step 3: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/reports/fase6-summary-2026-04-23.md
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "docs(eval): resumo da Fase 6 com métricas antes/depois"
```

---

## Task 13: Atualizar `ROADMAP_BUSCA_QUALIDADE.md`

**Files:**
- Modify: `docs/ROADMAP_BUSCA_QUALIDADE.md`

- [ ] **Step 1: Editar**

Na seção "Ordem sugerida de execução", atualizar o item da Fase 6 pra ✅ com referência ao summary. Exemplo:

Substituir:
```markdown
2. **Fase 6 — Auditoria do golden set** (3-4h) — **SUBIU PRA PRIMEIRO**. ...
```

Por:
```markdown
2. ✅ **Fase 6 — Auditoria do golden set** (concluída em 2026-04-23). Resumo: `eval/reports/fase6-summary-2026-04-23.md`. Novo baseline recall@5 = X.X% (era 34.1%, Δ +X.Xpp).
```

Atualizar "Baseline atual" no topo do roadmap com o novo número.

Se dedup spot-check revelou > 15 pares, adicionar antes de "Histórico":
```markdown
## Fase 7 — Dedup estrutural do banco (nova, registrada em 2026-04-23)

Spot-check durante Fase 6 revelou N pares de documentos duplicados em `Document` com mesmo título.
Fix estrutural: SQL de merge (manter 1 ID, atualizar referências em DocumentChunk e deletar duplicata).
Fora do escopo da Fase 6 por precisar de cuidado em produção. [...]
```

Atualizar "Histórico" no final:
```markdown
- **2026-04-23**: Fase 6 concluída. Golden set auditado — 34 adds + 1 remove nos 8 E, 2 IDs fantasma removidos, N adds via auditoria dos 43. recall@5: 34.1% → X.X%. Relatório: `eval/reports/fase6-summary-2026-04-23.md`.
```

- [ ] **Step 2: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add docs/ROADMAP_BUSCA_QUALIDADE.md
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "docs(roadmap): Fase 6 ✅ com novo baseline recall@5 + Fase 7 (se aplicável)"
```

---

## Self-review checklist (executado pelo autor do plano, não pelo executor)

- ✅ **Cobertura do spec:** 6A → Tasks 1-5; 6B → Tasks 6-10; 6C → Tasks 11-13.
- ✅ **Sem placeholders:** todos os steps que exigem código têm código completo. Task 12 tem template + checkpoint humano pra preencher números reais — intencional porque depende do eval run.
- ✅ **Consistência de tipos:** `GoldenOp`/`AuditCandidate`/`AuditRow`/`DecisionValue`/`KnownOperation`/`AnnotationList` definidos em Task 1 e usados consistentemente nos tests e implementações das Tasks 2-10.
- ✅ **Reuso:** `matchKeyTermsInText` da Fase 0 importado no `heuristic.ts`; `fetchDocTitles`/`fetchDocContents` importados no `annotation-audit.ts`. Nada reinventado.
- ✅ **Checkpoints humanos marcados:** Tasks 5 e 10 explicitamente `[HUMAN CHECKPOINT]`. Task 12 tem step manual pra preencher números.
- ✅ **Path alias `@/`:** usado nos imports conforme padrão já existente do projeto.

---

## Notas para o executor

- **Não é worktree-isolado.** Plano roda direto em `stripe-migration` (já ativo).
- **Custo de API em 6B:** Task 10 (`annotation-audit.ts`) não chama LLM — só lê DB via Prisma. Custo ~zero.
- **Tempo total estimado:**
  - Tasks 1-4, 6-9 (scripts + testes): ~2h via subagentes.
  - Task 5 (executar 6A interativo): ~15-20 min humano.
  - Task 10 (gerar + revisar CSV + aplicar): ~90-120 min humano.
  - Tasks 11-13 (re-eval + resumo + roadmap): ~20 min.
  - **Total humano ativo: ~2h30**.
- **Se alguma tarefa interativa (5 ou 10) der bug no meio:** o script é idempotente contra o golden (append-only + dry-run), então pode rodar de novo. Task 5 tem confirm final antes de salvar; Task 10 tem dry-run.
- **Task 12 Step 2** depende de visualmente copiar números do stdout. Subagente pode ser guiado com esses números no prompt, mas idealmente é passo humano.
