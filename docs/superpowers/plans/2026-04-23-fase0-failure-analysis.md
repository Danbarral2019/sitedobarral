# Fase 0 — Failure Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o diagnóstico auto+manual das 29 queries do golden set com `recall@5 ≤ 20%`, entregando `eval/reports/failure-analysis-2026-04-23.{md,csv}` que determina a ordem de execução das Fases 1-6 do `ROADMAP_BUSCA_QUALIDADE.md`.

**Architecture:** Um patch aditivo em `eval/cli/run-baseline.ts` (emitir JSON do `EvalRun`) + um módulo puro em `eval/scripts/failure-analysis/` (extração de key-terms, heurística de bucket, formatação MD/CSV) + um CLI orquestrador `eval/scripts/analyze-failures.ts` que consome o JSON, enriquece com Prisma (chunk counts, `docPositionInTop100`) e emite os relatórios. Lógica pura é testada via Vitest; integração com DB roda uma vez manualmente no final.

**Tech Stack:** TypeScript, Node ≥ 20, tsx, Vitest, Prisma (Neon Postgres), pgvector, hybridSearch existente (`lib/embeddings/hybrid-search.ts`).

**Spec:** `docs/superpowers/specs/2026-04-23-fase0-failure-analysis-design.md`

---

## File Structure

**Novos (em `eval/scripts/failure-analysis/`):**
- `types.ts` — `FailureRow`, `Signals`, `BucketAuto`, `FailureAnalysisReport`.
- `key-terms.ts` — regex puras para extrair termos "pesados" de uma query.
- `bucket-heuristic.ts` — regras ordenadas (C → D → A → A' → B) sobre `Signals` → `BucketAuto` + `reason`.
- `report-format.ts` — `formatMarkdown(report)` e `formatCSV(rows)`.
- `db-signals.ts` — Prisma queries para `docExists`, `chunkCount`, `docPositionInTop100`.

**Novo CLI:**
- `eval/scripts/analyze-failures.ts` — orquestrador. Lê JSON → enriquece → classifica → escreve MD+CSV.

**Testes (em `lib/__tests__/eval/failure-analysis/`, seguindo convenção atual):**
- `key-terms.test.ts`
- `bucket-heuristic.test.ts`
- `report-format.test.ts`

**Modificações:**
- `eval/cli/run-baseline.ts` — emitir `{stamp}_{label}.json` além do MD. ~10 linhas.

**Entregável final (commitado em run separado):**
- `eval/reports/failure-analysis-2026-04-23.md`
- `eval/reports/failure-analysis-2026-04-23.csv`

---

## Task 1: Patch `run-baseline.ts` para emitir JSON

**Files:**
- Modify: `eval/cli/run-baseline.ts` (após gravação do MD)

- [ ] **Step 1: Ler o arquivo atual**

Verificar linhas ~40-48 onde o markdown é gravado.

- [ ] **Step 2: Adicionar gravação JSON**

Logo após o `writeFileSync` do markdown, antes do `console.log` final, inserir:

```typescript
  const jsonFilename = `${stamp}_${label}.json`
  const jsonFullPath = join(reportsDir, jsonFilename)
  writeFileSync(jsonFullPath, JSON.stringify(run, null, 2), 'utf8')
  console.log(`[eval] JSON dump written to eval/reports/${jsonFilename}`)
```

- [ ] **Step 3: Rodar eval em modo smoke (sem esperar completar)**

Não precisa rodar o eval inteiro — só checar o diff:

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" diff eval/cli/run-baseline.ts
```

Expected: diff aditivo de 4 linhas.

- [ ] **Step 4: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/cli/run-baseline.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): emitir JSON dump do EvalRun para pós-análise"
```

---

## Task 2: Definir tipos compartilhados do módulo failure-analysis

**Files:**
- Create: `eval/scripts/failure-analysis/types.ts`

- [ ] **Step 1: Criar o arquivo com tipos**

```typescript
/**
 * Tipos do módulo de análise de falhas do retrieval (Fase 0 do
 * ROADMAP_BUSCA_QUALIDADE). Importados pelo CLI analyze-failures.ts
 * e pelos módulos puros (key-terms, bucket-heuristic, report-format).
 */

export type BucketAuto =
  | 'C'
  | 'C-parcial'
  | 'D'
  | 'D+'
  | 'A'
  | "A'"
  | 'B'

/** Sinais mecânicos coletados por query falha. */
export interface Signals {
  id: string
  query: string
  difficulty: 'easy' | 'medium' | 'hard'
  recallAt5: number
  reciprocalRank: number
  predictedTop20: string[]
  relevantIds: string[]
  highlyRelevantIds: string[]

  // Enriquecimento do DB
  relevantDocs: Array<{
    id: string
    exists: boolean
    title: string | null
    contentLen: number
    chunkCount: number
  }>

  /**
   * Posição do primeiro doc relevante no top-100 quando MRR = 0.
   * null se busca não retornou o doc em 100 resultados (ou se MRR > 0 —
   * neste caso usar round(1/reciprocalRank) para derivar posição).
   */
  docPositionInTop100: number | null

  // Derivados da query
  keyTerms: string[]
  keyTermsInExpectedDoc: Record<string, boolean>
  keyTermsInTop5Docs: Record<string, boolean>

  // Títulos dos top-5 (preenchidos junto com relevantDocs, por id)
  top5Titles: string[]
}

export interface BucketedRow extends Signals {
  bucketAuto: BucketAuto
  bucketReason: string
  /** Preenchido manualmente depois. Começa vazio. */
  bucketManual: string
}

export interface FailureAnalysisReport {
  sourceRunPath: string
  scopeDescription: string
  generatedAt: string
  rows: BucketedRow[]
}
```

- [ ] **Step 2: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/failure-analysis/types.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): tipos do módulo de failure-analysis (Fase 0)"
```

---

## Task 3: Implementar `key-terms.ts` (TDD)

**Files:**
- Test: `lib/__tests__/eval/failure-analysis/key-terms.test.ts`
- Create: `eval/scripts/failure-analysis/key-terms.ts`

- [ ] **Step 1: Escrever o teste falhando**

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { extractKeyTerms, matchKeyTermsInText } from '@/eval/scripts/failure-analysis/key-terms'

describe('extractKeyTerms', () => {
  it('extrai número de lei com ponto e ano', () => {
    expect(extractKeyTerms('art. 75 da Lei 14.133/2021')).toEqual(
      expect.arrayContaining(['14.133/2021', 'art. 75'])
    )
  })

  it('extrai número de IN com órgão', () => {
    expect(extractKeyTerms('IN SEGES/ME 65/2021 pesquisa de preços')).toEqual(
      expect.arrayContaining(['IN SEGES/ME 65/2021'])
    )
  })

  it('extrai siglas maiúsculas com mais de 2 letras', () => {
    expect(extractKeyTerms('o BDI em contratos de TIC')).toEqual(
      expect.arrayContaining(['BDI', 'TIC'])
    )
  })

  it('ignora stopwords maiúsculas comuns', () => {
    const terms = extractKeyTerms('DO ou DE OU a')
    expect(terms).not.toEqual(expect.arrayContaining(['OU', 'DE', 'DO']))
  })

  it('retorna array vazio para query sem termos pesados', () => {
    expect(extractKeyTerms('pregão bens e serviços comuns')).toEqual([])
  })

  it('deduplica termos repetidos', () => {
    const terms = extractKeyTerms('art. 75 e art. 75 novamente')
    const artCount = terms.filter((t) => t === 'art. 75').length
    expect(artCount).toBe(1)
  })
})

describe('matchKeyTermsInText', () => {
  it('retorna mapa bool por termo, case-insensitive', () => {
    const hit = matchKeyTermsInText(['14.133/2021', 'BDI'], 'Lei 14.133/2021 diz que o bdi deve...')
    expect(hit).toEqual({ '14.133/2021': true, BDI: true })
  })

  it('detecta ausência', () => {
    const hit = matchKeyTermsInText(['IN SEGES/ME 65/2021'], 'pesquisa de preços conforme art. 23')
    expect(hit).toEqual({ 'IN SEGES/ME 65/2021': false })
  })

  it('funciona com texto vazio', () => {
    const hit = matchKeyTermsInText(['BDI'], '')
    expect(hit).toEqual({ BDI: false })
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar com "module not found"**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npm run test:run -- lib/__tests__/eval/failure-analysis/key-terms.test.ts
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar key-terms.ts**

```typescript
/**
 * Extrai termos "pesados" de uma query do golden set — números de lei,
 * artigos, nomes de INs, siglas — que servem de evidência para distinguir
 * buckets A (termo ausente do doc) vs B (parafraseamento semântico).
 */

// Stopwords em caixa-alta que não são siglas úteis
const STOPWORDS_UPPER = new Set(['DO', 'DA', 'DE', 'OU', 'NA', 'NO', 'EM', 'ART', 'LEI'])

const PATTERNS: Array<RegExp> = [
  // Lei 14.133/2021, 8.666/93 etc.
  /\b\d{1,3}\.\d{3}\/\d{2,4}\b/g,
  // art. 75, art 75, artigo 75, Art. 183
  /\bart(?:igo)?\.?\s*\d+\b/gi,
  // IN SEGES/ME 65/2021, IN CGU 1/2022 etc.
  /\bIN\s+[A-Z][A-Z/]*\s+\d+\/\d{2,4}\b/g,
  // Decreto-Lei, ON 84, Súmula 473 etc. — número isolado com rótulo
  /\b(?:ON|D[eE]creto|Súmula|Acórdão|Portaria)\s+\d+(?:\/\d{2,4})?\b/g,
]

const UPPER_SIGLA = /\b[A-Z]{2,}\b/g

/** Extrai key-terms únicos de uma query. Ordem de aparição preservada. */
export function extractKeyTerms(query: string): string[] {
  const hits: string[] = []
  const seen = new Set<string>()

  const push = (t: string) => {
    const key = t.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      hits.push(t)
    }
  }

  for (const rx of PATTERNS) {
    const matches = query.match(rx) ?? []
    for (const m of matches) push(m.trim())
  }

  const siglas = query.match(UPPER_SIGLA) ?? []
  for (const s of siglas) {
    if (!STOPWORDS_UPPER.has(s)) push(s)
  }

  return hits
}

/**
 * Para cada termo, indica se aparece no texto (substring case-insensitive).
 * Retorna um objeto bool-por-termo, na ordem dos termos passados.
 */
export function matchKeyTermsInText(
  terms: string[],
  text: string
): Record<string, boolean> {
  const lc = text.toLowerCase()
  const out: Record<string, boolean> = {}
  for (const t of terms) {
    out[t] = lc.includes(t.toLowerCase())
  }
  return out
}
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
npm run test:run -- lib/__tests__/eval/failure-analysis/key-terms.test.ts
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/failure-analysis/key-terms.ts lib/__tests__/eval/failure-analysis/key-terms.test.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): extrator puro de key-terms para failure-analysis"
```

---

## Task 4: Implementar `bucket-heuristic.ts` (TDD)

**Files:**
- Test: `lib/__tests__/eval/failure-analysis/bucket-heuristic.test.ts`
- Create: `eval/scripts/failure-analysis/bucket-heuristic.ts`

- [ ] **Step 1: Escrever o teste falhando**

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { classifyBucket, effectivePosition } from '@/eval/scripts/failure-analysis/bucket-heuristic'
import type { Signals } from '@/eval/scripts/failure-analysis/types'

function baseSignals(overrides: Partial<Signals> = {}): Signals {
  return {
    id: 'q-test',
    query: 'teste',
    difficulty: 'medium',
    recallAt5: 0,
    reciprocalRank: 0,
    predictedTop20: [],
    relevantIds: ['d1'],
    highlyRelevantIds: [],
    relevantDocs: [{ id: 'd1', exists: true, title: 'T', contentLen: 500, chunkCount: 5 }],
    docPositionInTop100: null,
    keyTerms: [],
    keyTermsInExpectedDoc: {},
    keyTermsInTop5Docs: {},
    top5Titles: [],
    ...overrides,
  }
}

describe('effectivePosition', () => {
  it('usa 1/reciprocalRank quando MRR > 0', () => {
    expect(effectivePosition({ reciprocalRank: 0.1, docPositionInTop100: null } as Signals)).toBe(10)
    expect(effectivePosition({ reciprocalRank: 0.167, docPositionInTop100: null } as Signals)).toBe(6)
  })

  it('usa docPositionInTop100 quando MRR = 0', () => {
    expect(effectivePosition({ reciprocalRank: 0, docPositionInTop100: 47 } as Signals)).toBe(47)
  })

  it('retorna null se ambos ausentes', () => {
    expect(effectivePosition({ reciprocalRank: 0, docPositionInTop100: null } as Signals)).toBeNull()
  })
})

describe('classifyBucket — Regra 1 (C)', () => {
  it('bucket C quando nenhum relevante tem chunks', () => {
    const s = baseSignals({
      relevantDocs: [{ id: 'd1', exists: true, title: 'T', contentLen: 500, chunkCount: 0 }],
    })
    const { bucket, reason } = classifyBucket(s)
    expect(bucket).toBe('C')
    expect(reason).toMatch(/chunk/i)
  })

  it('bucket C-parcial quando alguns têm chunks, outros não', () => {
    const s = baseSignals({
      relevantIds: ['d1', 'd2'],
      relevantDocs: [
        { id: 'd1', exists: true, title: 'T1', contentLen: 500, chunkCount: 5 },
        { id: 'd2', exists: true, title: 'T2', contentLen: 500, chunkCount: 0 },
      ],
    })
    expect(classifyBucket(s).bucket).toBe('C-parcial')
  })
})

describe('classifyBucket — Regra 2 (D/D+)', () => {
  it('bucket D quando MRR > 0 com posição 11-20', () => {
    const s = baseSignals({ reciprocalRank: 1 / 12 })
    const { bucket } = classifyBucket(s)
    expect(bucket).toBe('D')
  })

  it('bucket D+ quando posição efetiva ≤ 10', () => {
    const s = baseSignals({ reciprocalRank: 1 / 8 })
    expect(classifyBucket(s).bucket).toBe('D+')
  })

  it('bucket D quando MRR=0 mas docPositionInTop100 ∈ [11, 20]', () => {
    const s = baseSignals({ reciprocalRank: 0, docPositionInTop100: 15 })
    expect(classifyBucket(s).bucket).toBe('D')
  })

  it('bucket D+ quando MRR=0 e docPositionInTop100 ∈ [6, 10]', () => {
    const s = baseSignals({ reciprocalRank: 0, docPositionInTop100: 8 })
    expect(classifyBucket(s).bucket).toBe('D+')
  })
})

describe("classifyBucket — Regra 3 (A) e 4 (A')", () => {
  it('bucket A quando key terms existem mas ausentes do doc esperado', () => {
    const s = baseSignals({
      keyTerms: ['IN SEGES/ME 65/2021'],
      keyTermsInExpectedDoc: { 'IN SEGES/ME 65/2021': false },
      docPositionInTop100: null, // fora do top-100
    })
    expect(classifyBucket(s).bucket).toBe('A')
  })

  it("bucket A' quando termo presente no doc mas doc fora do top-100", () => {
    const s = baseSignals({
      keyTerms: ['14.133/2021'],
      keyTermsInExpectedDoc: { '14.133/2021': true },
      docPositionInTop100: null, // fora do top-100
    })
    expect(classifyBucket(s).bucket).toBe("A'")
  })
})

describe('classifyBucket — Regra 5 (B fallback)', () => {
  it('bucket B quando nada bate', () => {
    const s = baseSignals({
      keyTerms: [], // sem key terms → não cai em A/A'
      docPositionInTop100: null,
    })
    expect(classifyBucket(s).bucket).toBe('B')
  })
})
```

- [ ] **Step 2: Rodar teste — falha de módulo não encontrado**

```bash
npm run test:run -- lib/__tests__/eval/failure-analysis/bucket-heuristic.test.ts
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar bucket-heuristic.ts**

```typescript
import type { BucketAuto, Signals } from './types'

/**
 * Converte (reciprocalRank, docPositionInTop100) na posição efetiva do
 * primeiro doc relevante no ranking.
 * - Se MRR > 0 → round(1/MRR) (do top-20 que o eval já viu).
 * - Senão, se docPositionInTop100 preenchido → usa direto.
 * - Senão → null (doc fora do top-100).
 */
export function effectivePosition(s: Pick<Signals, 'reciprocalRank' | 'docPositionInTop100'>): number | null {
  if (s.reciprocalRank > 0) return Math.round(1 / s.reciprocalRank)
  if (s.docPositionInTop100 !== null) return s.docPositionInTop100
  return null
}

export interface BucketDecision {
  bucket: BucketAuto
  reason: string
}

/**
 * Classifica uma query falha em um bucket seguindo as 5 regras ordenadas
 * do spec Fase 0. Primeira regra que bate vence.
 */
export function classifyBucket(s: Signals): BucketDecision {
  // Regra 1: C / C-parcial — chunks
  const anyWithoutChunks = s.relevantDocs.some((d) => d.chunkCount === 0)
  const allWithoutChunks = s.relevantDocs.every((d) => d.chunkCount === 0)
  if (allWithoutChunks) {
    return { bucket: 'C', reason: 'nenhum doc relevante tem chunks indexados' }
  }
  if (anyWithoutChunks) {
    return {
      bucket: 'C-parcial',
      reason: 'alguns docs relevantes não têm chunks (indexação parcial)',
    }
  }

  // Regra 2: D / D+ — ranking ruim
  const pos = effectivePosition(s)
  if (pos !== null && pos <= 20) {
    if (pos <= 10) {
      return { bucket: 'D+', reason: `doc relevante em posição ${pos} (próximo do top-5)` }
    }
    return { bucket: 'D', reason: `doc relevante em posição ${pos} (top-20 mas não top-5)` }
  }

  // Regras 3 e 4: A / A' — key terms
  if (s.keyTerms.length > 0) {
    const anyTermInExpected = Object.values(s.keyTermsInExpectedDoc).some(Boolean)
    if (!anyTermInExpected) {
      return {
        bucket: 'A',
        reason: `key terms [${s.keyTerms.join(', ')}] ausentes do content dos docs relevantes`,
      }
    }
    // Termos presentes mas doc longe
    return {
      bucket: "A'",
      reason: 'key terms presentes no doc esperado, mas doc fora do top-100 (FTS deveria ter pego)',
    }
  }

  // Regra 5: B — fallback
  return {
    bucket: 'B',
    reason: 'doc indexado, sem termos específicos na query, vetor não aproxima o bastante',
  }
}
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
npm run test:run -- lib/__tests__/eval/failure-analysis/bucket-heuristic.test.ts
```

Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/failure-analysis/bucket-heuristic.ts lib/__tests__/eval/failure-analysis/bucket-heuristic.test.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): heurística pura de bucket (C/D/A/A'/B) para failure-analysis"
```

---

## Task 5: Implementar `db-signals.ts`

**Files:**
- Create: `eval/scripts/failure-analysis/db-signals.ts`

Este módulo faz I/O (Prisma + hybridSearch), então não tem teste unit puro. Será exercitado na execução final (Task 8).

- [ ] **Step 1: Criar o arquivo**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/failure-analysis/db-signals.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): coletor de sinais DB (docExists, chunks, top-100) para failure-analysis"
```

---

## Task 6: Implementar `report-format.ts` (TDD)

**Files:**
- Test: `lib/__tests__/eval/failure-analysis/report-format.test.ts`
- Create: `eval/scripts/failure-analysis/report-format.ts`

- [ ] **Step 1: Escrever o teste falhando**

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { formatCSV, formatMarkdown } from '@/eval/scripts/failure-analysis/report-format'
import type { BucketedRow, FailureAnalysisReport } from '@/eval/scripts/failure-analysis/types'

function row(overrides: Partial<BucketedRow> = {}): BucketedRow {
  return {
    id: 'q-test',
    query: 'teste',
    difficulty: 'medium',
    recallAt5: 0,
    reciprocalRank: 0.1,
    predictedTop20: ['x1', 'x2'],
    relevantIds: ['d1'],
    highlyRelevantIds: [],
    relevantDocs: [{ id: 'd1', exists: true, title: 'Doc 1', contentLen: 500, chunkCount: 3 }],
    docPositionInTop100: null,
    keyTerms: ['BDI'],
    keyTermsInExpectedDoc: { BDI: true },
    keyTermsInTop5Docs: { BDI: false },
    top5Titles: ['t1', 't2', 't3', 't4', 't5'],
    bucketAuto: 'D',
    bucketReason: 'pos 10',
    bucketManual: '',
    ...overrides,
  }
}

describe('formatCSV', () => {
  it('tem header com colunas esperadas', () => {
    const csv = formatCSV([row()])
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toContain('id')
    expect(firstLine).toContain('bucket_auto')
    expect(firstLine).toContain('bucket_manual')
  })

  it('escapa vírgulas e aspas em campos', () => {
    const csv = formatCSV([row({ query: 'um, dois "três"' })])
    expect(csv).toContain('"um, dois ""três"""')
  })

  it('linha por row', () => {
    const csv = formatCSV([row({ id: 'a' }), row({ id: 'b' })])
    expect(csv.split('\n').filter(Boolean)).toHaveLength(3) // header + 2
  })
})

describe('formatMarkdown', () => {
  const report: FailureAnalysisReport = {
    sourceRunPath: 'eval/reports/x.json',
    scopeDescription: '29 queries com recall@5 ≤ 20%',
    generatedAt: '2026-04-23',
    rows: [
      row({ bucketAuto: 'D', id: 'q-a' }),
      row({ bucketAuto: 'A', id: 'q-b' }),
      row({ bucketAuto: 'D', id: 'q-c' }),
    ],
  }

  it('tem título e cabeçalho com run fonte', () => {
    const md = formatMarkdown(report)
    expect(md).toContain('# Failure Analysis')
    expect(md).toContain('eval/reports/x.json')
  })

  it('tabela de distribuição por bucket com contagens corretas', () => {
    const md = formatMarkdown(report)
    expect(md).toMatch(/\|\s*D\b[^|]*\|\s*2/) // D aparece 2 vezes
    expect(md).toMatch(/\|\s*A\b[^|]*\|\s*1/) // A aparece 1 vez
  })

  it('tem seção drill-down por query', () => {
    const md = formatMarkdown(report)
    expect(md).toContain('### q-a')
    expect(md).toContain('### q-b')
    expect(md).toContain('### q-c')
  })

  it('tem seção "Como reproduzir"', () => {
    const md = formatMarkdown(report)
    expect(md).toContain('Como reproduzir')
    expect(md).toContain('analyze-failures.ts')
  })
})
```

- [ ] **Step 2: Rodar teste — deve falhar**

```bash
npm run test:run -- lib/__tests__/eval/failure-analysis/report-format.test.ts
```

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar report-format.ts**

```typescript
import type { BucketAuto, BucketedRow, FailureAnalysisReport } from './types'

const CSV_COLUMNS = [
  'id',
  'query',
  'difficulty',
  'recall@5',
  'mrr',
  'n_relevant',
  'n_relevant_with_chunks',
  'doc_position_top100',
  'key_terms',
  'key_terms_in_expected',
  'key_terms_in_top5',
  'top5_titles',
  'bucket_auto',
  'bucket_reason',
  'bucket_manual',
] as const

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function serializeTermMap(m: Record<string, boolean>): string {
  return Object.entries(m).map(([k, v]) => `${k}=${v ? 'Y' : 'N'}`).join(';')
}

export function formatCSV(rows: BucketedRow[]): string {
  const lines: string[] = [CSV_COLUMNS.join(',')]
  for (const r of rows) {
    const nRelevantWithChunks = r.relevantDocs.filter((d) => d.chunkCount > 0).length
    const values = [
      r.id,
      r.query,
      r.difficulty,
      r.recallAt5.toFixed(3),
      r.reciprocalRank.toFixed(3),
      r.relevantDocs.length,
      nRelevantWithChunks,
      r.docPositionInTop100 ?? '',
      r.keyTerms.join(';'),
      serializeTermMap(r.keyTermsInExpectedDoc),
      serializeTermMap(r.keyTermsInTop5Docs),
      r.top5Titles.join(' || '),
      r.bucketAuto,
      r.bucketReason,
      r.bucketManual,
    ]
    lines.push(values.map(csvEscape).join(','))
  }
  return lines.join('\n')
}

const ALL_BUCKETS: BucketAuto[] = ['A', "A'", 'B', 'C', 'C-parcial', 'D', 'D+']

const PHASE_HINT: Record<BucketAuto, string> = {
  A: 'Fase 1 (HyDE) + Fase 3 (embedding)',
  "A'": 'Fase 4 (tuning FTS)',
  B: 'Fase 3 (embedding) ou Fase 5 (chunking)',
  C: 'Fix scraper / re-rodar migrate-to-embeddings',
  'C-parcial': 'Fix scraper / re-rodar migrate-to-embeddings (parcial)',
  D: 'Fase 2 (rerank) ou Fase 4 (hybrid tuning)',
  'D+': 'Fase 2 (rerank) — alta confiança',
}

export function formatMarkdown(report: FailureAnalysisReport): string {
  const counts: Record<BucketAuto, number> = {
    A: 0, "A'": 0, B: 0, C: 0, 'C-parcial': 0, D: 0, 'D+': 0,
  }
  for (const r of report.rows) counts[r.bucketAuto]++

  const lines: string[] = []
  lines.push(`# Failure Analysis — ${report.generatedAt}`)
  lines.push('')
  lines.push(`- **Run fonte:** ${report.sourceRunPath}`)
  lines.push(`- **Escopo:** ${report.scopeDescription}`)
  lines.push(`- **Metodologia:** \`eval/scripts/analyze-failures.ts\` (ver "Como reproduzir")`)
  lines.push('')

  lines.push('## Distribuição por bucket')
  lines.push('')
  lines.push('| Bucket | Auto | Após review | Fase sugerida |')
  lines.push('|---|---|---|---|')
  for (const b of ALL_BUCKETS) {
    lines.push(`| ${b} | ${counts[b]} | _(preencher)_ | ${PHASE_HINT[b]} |`)
  }
  lines.push(`| E. Anotação suspeita | — | _(preencher)_ | Fase 6 |`)
  lines.push('')

  lines.push('## Recomendação de ordem revisada das fases')
  lines.push('')
  lines.push('_(Preencher após revisão manual — 3-5 bullets concretos baseados na distribuição final.)_')
  lines.push('')

  lines.push('## Drill-down por query')
  lines.push('')
  for (const r of report.rows) {
    lines.push(`### ${r.id} — bucket ${r.bucketAuto}`)
    lines.push(`- **Query:** ${r.query}`)
    lines.push(`- **Difficulty:** ${r.difficulty}`)
    lines.push(`- **recall@5 / MRR:** ${(r.recallAt5 * 100).toFixed(1)}% / ${r.reciprocalRank.toFixed(3)}`)
    lines.push(`- **Doc(s) esperado(s):** ${r.relevantDocs.map((d) => `${d.title ?? '—'} (${d.id.slice(0, 8)}, chunks=${d.chunkCount})`).join('; ')}`)
    lines.push(`- **Key terms:** ${r.keyTerms.length > 0 ? r.keyTerms.join(', ') : '—'}`)
    if (r.keyTerms.length > 0) {
      lines.push(`- **Em doc esperado?** ${serializeTermMap(r.keyTermsInExpectedDoc)}`)
      lines.push(`- **Em top-5?** ${serializeTermMap(r.keyTermsInTop5Docs)}`)
    }
    lines.push(`- **Posição top-100:** ${r.docPositionInTop100 ?? '—'}`)
    lines.push(`- **Top-5 retornados:** ${r.top5Titles.join(' || ') || '—'}`)
    lines.push(`- **Por que ${r.bucketAuto}:** ${r.bucketReason}`)
    lines.push(`- **Bucket review:** _(preencher — confirmado ou reclassificar)_`)
    lines.push('')
  }

  lines.push('## Como reproduzir')
  lines.push('')
  lines.push('```bash')
  lines.push('npm run eval:run -- --label diag-fase0')
  lines.push('npx tsx eval/scripts/analyze-failures.ts --from eval/reports/<stamp>_diag-fase0.json')
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}
```

- [ ] **Step 4: Rodar teste — deve passar**

```bash
npm run test:run -- lib/__tests__/eval/failure-analysis/report-format.test.ts
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/failure-analysis/report-format.ts lib/__tests__/eval/failure-analysis/report-format.test.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): formatadores MD/CSV de failure-analysis"
```

---

## Task 7: Implementar CLI orquestrador `analyze-failures.ts`

**Files:**
- Create: `eval/scripts/analyze-failures.ts`

- [ ] **Step 1: Criar o CLI**

```typescript
/**
 * Analisa as queries com recall@5 ≤ 20% de um EvalRun, enriquece com
 * sinais do DB e classifica em buckets (C/D/A/A'/B) seguindo o spec
 * docs/superpowers/specs/2026-04-23-fase0-failure-analysis-design.md.
 *
 * Uso:
 *   tsx eval/scripts/analyze-failures.ts --from eval/reports/<stamp>_<label>.json
 *   tsx eval/scripts/analyze-failures.ts            # auto-detecta o JSON mais recente
 *   tsx eval/scripts/analyze-failures.ts --threshold 0.2
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { EvalRun, GoldenQuery, GoldenSet, QueryEvalResult } from '../types'
import { extractKeyTerms, matchKeyTermsInText } from './failure-analysis/key-terms'
import { classifyBucket } from './failure-analysis/bucket-heuristic'
import { formatCSV, formatMarkdown } from './failure-analysis/report-format'
import {
  fetchDocSignal,
  fetchDocContents,
  fetchDocTitles,
  findFirstRelevantPositionInTop100,
} from './failure-analysis/db-signals'
import type { BucketedRow, FailureAnalysisReport, Signals } from './failure-analysis/types'

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const from = get('--from')
  const thresholdRaw = get('--threshold')
  const threshold = thresholdRaw !== undefined ? parseFloat(thresholdRaw) : 0.2
  return { from, threshold }
}

function findLatestJsonRun(reportsDir: string): string {
  const files = readdirSync(reportsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
  if (files.length === 0) throw new Error('Nenhum JSON em eval/reports/. Rode `npm run eval:run` antes.')
  return join(reportsDir, files[0])
}

async function buildSignals(
  result: QueryEvalResult,
  goldenQuery: GoldenQuery
): Promise<Signals> {
  const relevantIds = goldenQuery.annotations.relevant
  const highlyRelevantIds = goldenQuery.annotations.highlyRelevant
  const keyTerms = extractKeyTerms(goldenQuery.query)

  // Enriquecimento paralelo
  const top5Ids = result.predicted.slice(0, 5)
  const [docSignals, expectedContents, top5Titles, top5Contents] = await Promise.all([
    Promise.all(relevantIds.map((id) => fetchDocSignal(id))),
    fetchDocContents(relevantIds),
    fetchDocTitles(top5Ids),
    fetchDocContents(top5Ids),
  ])

  const expectedConcat = relevantIds.map((id) => expectedContents[id] ?? '').join('\n\n')
  const top5Concat = top5Ids.map((id) => top5Contents[id] ?? '').join('\n\n')

  const needsTop100 =
    result.reciprocalRank === 0 && relevantIds.length > 0
  const docPositionInTop100 = needsTop100
    ? await findFirstRelevantPositionInTop100(goldenQuery.query, relevantIds)
    : null

  return {
    id: result.id,
    query: result.query,
    difficulty: result.difficulty,
    recallAt5: result.recallAt5,
    reciprocalRank: result.reciprocalRank,
    predictedTop20: result.predicted,
    relevantIds,
    highlyRelevantIds,
    relevantDocs: docSignals,
    docPositionInTop100,
    keyTerms,
    keyTermsInExpectedDoc: matchKeyTermsInText(keyTerms, expectedConcat),
    keyTermsInTop5Docs: matchKeyTermsInText(keyTerms, top5Concat),
    top5Titles: top5Ids.map((id) => top5Titles[id] ?? '—'),
  }
}

async function main() {
  const { from, threshold } = parseArgs()
  const reportsDir = join(process.cwd(), 'eval/reports')
  const jsonPath = from ?? findLatestJsonRun(reportsDir)

  console.log(`[fa] Lendo run: ${jsonPath}`)
  const run: EvalRun = JSON.parse(readFileSync(jsonPath, 'utf8'))

  const goldenPath = join(process.cwd(), 'eval/golden-set.json')
  const golden: GoldenSet = JSON.parse(readFileSync(goldenPath, 'utf8'))
  const goldenById = new Map(golden.queries.map((q) => [q.id, q]))

  const failed = run.perQuery.filter((r) => r.recallAt5 <= threshold)
  console.log(`[fa] Encontradas ${failed.length} queries com recall@5 ≤ ${threshold}`)

  const rows: BucketedRow[] = []
  for (let i = 0; i < failed.length; i++) {
    const result = failed[i]
    const gq = goldenById.get(result.id)
    if (!gq) {
      console.warn(`[fa] golden query ${result.id} não encontrada, pulando`)
      continue
    }
    console.log(`[fa] ${i + 1}/${failed.length} — ${result.id}`)
    const signals = await buildSignals(result, gq)
    const { bucket, reason } = classifyBucket(signals)
    rows.push({ ...signals, bucketAuto: bucket, bucketReason: reason, bucketManual: '' })
  }

  const report: FailureAnalysisReport = {
    sourceRunPath: jsonPath.replace(/\\/g, '/'),
    scopeDescription: `${rows.length} queries com recall@5 ≤ ${(threshold * 100).toFixed(0)}%`,
    generatedAt: new Date().toISOString().slice(0, 10),
    rows,
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const mdPath = join(reportsDir, `failure-analysis-${stamp}.md`)
  const csvPath = join(reportsDir, `failure-analysis-${stamp}.csv`)
  writeFileSync(mdPath, formatMarkdown(report), 'utf8')
  writeFileSync(csvPath, formatCSV(rows), 'utf8')

  console.log(`[fa] MD:  ${mdPath}`)
  console.log(`[fa] CSV: ${csvPath}`)
  console.log('[fa] Distribuição auto:')
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.bucketAuto] = (counts[r.bucketAuto] ?? 0) + 1
  for (const [b, n] of Object.entries(counts).sort()) console.log(`[fa]   ${b}: ${n}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[fa] FAILED:', err)
    process.exit(1)
  })
```

- [ ] **Step 2: Checar type-check do projeto**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "eval/scripts/" | head -20
```

Expected: sem erros em `eval/scripts/`. Se aparecer erro de import path, checar se `@/` mapeia para raiz (já usado em outros evals).

- [ ] **Step 3: Commit**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/scripts/analyze-failures.ts
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "feat(eval): CLI analyze-failures.ts — orquestra failure analysis (Fase 0)"
```

---

## Task 8: Rodar o diagnóstico, revisar manualmente, commitar report final

**Files:**
- Run: scripts
- Create: `eval/reports/failure-analysis-2026-04-23.md` (gerado + revisado)
- Create: `eval/reports/failure-analysis-2026-04-23.csv` (gerado + revisado)

- [ ] **Step 1: Rodar eval base com JSON dump**

```bash
cd "/c/Projeto de site do Barral/sitedobarral-stripe"
npm run eval:run -- --label diag-fase0
```

Expected:
- Termina com `[eval] recall@5=~34.1% ...` (bate com baseline).
- Escreve `eval/reports/<stamp>_diag-fase0.md` E `<stamp>_diag-fase0.json`.

- [ ] **Step 2: Rodar análise de falhas**

```bash
npx dotenv -e .env.local -- tsx eval/scripts/analyze-failures.ts
```

(Precisa de `dotenv -e .env.local` porque o Prisma lê `DATABASE_URL` do `.env.local`, igual ao `eval:run`.)

Expected:
- Log `[fa] Encontradas 29 queries com recall@5 ≤ 0.2`
- Para cada query: `[fa] N/29 — q-id`
- Distribuição auto impressa no final.
- `eval/reports/failure-analysis-2026-04-23.md` + `.csv` criados.

- [ ] **Step 3: Revisar o CSV**

Abrir `eval/reports/failure-analysis-2026-04-23.csv` (ex.: no VSCode ou planilha) e preencher a coluna `bucket_manual` para cada linha:
- Se `bucket_auto` estiver certo → copiar valor para `bucket_manual`.
- Se errado → escrever o bucket correto + justificativa em uma ou duas frases no `bucket_manual` (ex.: `A (reclass — termo "data a data" realmente não existe no doc)`).
- Se perceber que o golden anotou errado (um doc retornado top-5 responderia a query) → `E (anotação suspeita — doc X também cabia)`.

Objetivo: toda linha com `bucket_manual` preenchido.

- [ ] **Step 4: Atualizar o markdown com contagens finais e recomendação**

Editar `eval/reports/failure-analysis-2026-04-23.md`:
1. Na tabela "Distribuição por bucket", preencher coluna "Após review" com contagem por bucket final (do CSV).
2. Escrever a seção "Recomendação de ordem revisada das fases" — 3 a 5 bullets curtos. Exemplo de forma (não de conteúdo; preencher com achados reais):
   - "Fase 2 (rerank) primeiro — N queries em D+ sugerem ganho mais fácil."
   - "Fase 1 (HyDE) em paralelo — M queries em A dependem de expansão semântica."
   - "Fase 3 (embedding) só se 1+2 não atingirem meta — risco/custo alto."
   - "Fase 6 (golden set) — K queries em E exigem auditoria do set antes de novos runs."

3. No drill-down, para cada query, substituir `_(preencher — confirmado ou reclassificar)_` pelo bucket manual + 1-2 frases de contexto.

- [ ] **Step 5: Commit do diagnóstico final**

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add eval/reports/failure-analysis-2026-04-23.md eval/reports/failure-analysis-2026-04-23.csv eval/reports/*diag-fase0*
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "$(cat <<'EOF'
docs(eval): Fase 0 concluída — failure analysis de 29 queries (recall@5 ≤ 20%)

Distribuição final e recomendação de ordem das Fases 1-6 do
ROADMAP_BUSCA_QUALIDADE.md. Artefatos:
- failure-analysis-2026-04-23.md (narrativa + recomendação)
- failure-analysis-2026-04-23.csv (tabular, bucket_manual preenchido)
- <stamp>_diag-fase0.{md,json} (eval base usado)
EOF
)"
```

- [ ] **Step 6: Atualizar o roadmap principal marcando Fase 0 como concluída**

Editar `docs/ROADMAP_BUSCA_QUALIDADE.md`:
1. Na seção "Ordem sugerida de execução", marcar Fase 0 como ✅ e apontar para o report.
2. Reordenar as Fases 1-6 conforme a "Recomendação" escrita no Step 4.
3. Atualizar o "Histórico" no fim do arquivo.

```bash
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" add docs/ROADMAP_BUSCA_QUALIDADE.md
git -C "/c/Projeto de site do Barral/sitedobarral-stripe" commit -m "docs(roadmap): Fase 0 concluída — reordenar 1-6 conforme diagnóstico"
```

---

## Self-review checklist (executado pelo autor do plano, não pelo executor)

- ✅ **Cobertura do spec:** todas as seções do spec têm task correspondente (arquitetura → T1+T7, sinais → T3+T5, heurística → T4, formato → T6, critério de aceite → T8).
- ✅ **Sem placeholders:** todos os steps que exigem código têm código completo.
- ✅ **Consistência de tipos:** `Signals`/`BucketedRow`/`BucketAuto` definidos em T2 e usados nos testes e implementações de T3-T7 com nomes idênticos.
- ✅ **Comandos exatos:** `npm run test:run -- <arquivo>`, `npx dotenv -e .env.local -- tsx ...`, caminhos absolutos com `git -C`.
- ✅ **TDD onde faz sentido:** T3, T4, T6 têm test-first. T5 (DB I/O) e T7 (CLI glue) são integration-tested em T8. T1 é patch trivial de 4 linhas.
- ✅ **Commits frequentes:** cada task termina em commit, com mensagens padrão do projeto.

---

## Notas para o executor

- **Não é worktree-isolado.** O spec/plan prevê execução direta no branch `stripe-migration` (já ativo). Se quiser isolar, use `superpowers:using-git-worktrees` antes de T1.
- **Custo de API esperado em T8:** `findFirstRelevantPositionInTop100` roda `hybridSearch` com `limit: 100` para as queries com `MRR = 0` (estimado ~18 queries). Custo em embeddings/busca é desprezível — não passa dos cents.
- **Se `analyze-failures.ts` quebrar em alguma query:** o log mostra `[fa] N/29 — q-id`. Identificar o id, investigar (doc não existe? content null? retornou fora de uuid?), corrigir o script ou o dado.
- **Revisão do CSV em T8.3 é o gargalo.** Esperar 2-4h focadas. Se aparecer padrão inesperado (ex.: muitas queries com anotação suspeita), parar e conversar antes de seguir.
