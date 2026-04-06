# Framework de Avaliação de Busca (Golden Set + Métricas) — Fase 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um framework reprodutível que mede a qualidade do retrieval da busca jurídica do site (sem síntese, só ranking de documentos), usando um golden set curado pelo procurador, com três métricas padrão (recall@5, MRR, nDCG@10), permitindo comparar mudanças futuras de forma objetiva.

**Architecture:** Golden set como JSON versionado em git. Metrics module puro (entrada: ranking previsto + ground truth, saída: número). Adapter que chama o `hybridSearch` existente diretamente (import de lib, sem dev server). Runner que itera o golden set, agrega resultados e gera relatório markdown. Duas CLIs `tsx`: `annotate` (interativa, ajuda o usuário a marcar relevância) e `run-baseline` (não-interativa, gera relatório). Reports são commitados para timeline visível.

**Tech Stack:** TypeScript, tsx (já usado pelo projeto em scripts), Vitest, `@/lib/embeddings/hybrid-search` (já existe), `@/lib/ai` (camada da Fase 1, ainda não usada aqui mas disponível), `@inquirer/prompts` ou `readline` para CLI interativa.

**Não-objetivos desta fase:**
- Avaliar a qualidade do **texto sintetizado** pela LLM (alucinações, fidelidade às fontes) — isso seria uma "Fase 2.5" com LLM-as-judge. Aqui medimos só retrieval.
- Mudar `hybridSearch` ou qualquer componente do pipeline. O eval só observa.
- Construir UI web para anotação. CLI é suficiente para 50 queries.
- Avaliar busca em `/api/lei-14133/search` separadamente. Vamos focar em `hybridSearch` (a função principal usada pela rota `/api/documents/query`). Lei-14133 entra numa iteração futura se houver sinal.

**Premissa estrutural:** o golden set é um *living document*. Esta fase entrega o framework + 1 query semente (a "data a data" que falhou). O usuário expande para 50 queries usando o CLI `annotate` em sessões posteriores. As métricas só ficam estatisticamente significativas com ~30+ queries; até lá, o framework existe mas os números são indicativos.

---

## Estrutura de arquivos

```
sitedobarral/
├── eval/
│   ├── golden-set.json              (CRIAR — começa com 1 query semente)
│   ├── types.ts                     (CRIAR — GoldenQuery, EvalResult, MetricSummary)
│   ├── metrics.ts                   (CRIAR — recall@k, MRR, nDCG@k puros)
│   ├── search-adapter.ts            (CRIAR — wrapper de hybridSearch → string[])
│   ├── runner.ts                    (CRIAR — orchestrator)
│   ├── report.ts                    (CRIAR — formatter markdown)
│   ├── cli/
│   │   ├── annotate.ts              (CRIAR — CLI interativa de anotação)
│   │   └── run-baseline.ts          (CRIAR — CLI de execução)
│   ├── reports/
│   │   └── .gitkeep                 (CRIAR — diretório versionado, vazio)
│   └── README.md                    (CRIAR — documentação curta de uso)
├── lib/__tests__/eval/
│   └── metrics.test.ts              (CRIAR — TDD das métricas)
└── package.json                     (MODIFICAR — adicionar npm scripts eval:annotate / eval:run)
```

**Justificativa para `eval/` na raiz** (não em `lib/`): é uma ferramenta de meta-engenharia, não código de aplicação. Não roda em produção, não é importada por nenhuma rota. Mantê-lo separado deixa claro o limite. Pattern similar ao `scripts/` que já existe.

---

## Esquema do golden set (`eval/golden-set.json`)

```json
{
  "version": 1,
  "createdAt": "2026-04-06",
  "queries": [
    {
      "id": "q-data-a-data",
      "query": "sistema data a data",
      "description": "Termo técnico para contagem de prazo de vigência de contratos. Citado expressamente no art. 183, II da Lei 14.133.",
      "category": "termo-juridico-especifico",
      "difficulty": "hard",
      "annotations": {
        "relevant": [],
        "highlyRelevant": [],
        "annotatedAt": null,
        "annotatedBy": null,
        "notes": "Hoje a busca devolve resposta sobre reajuste de preços (art. 134, 182, 124) — completamente fora do tópico. O documento certo é o art. 183 II da Lei 14.133."
      }
    }
  ]
}
```

**Campos:**
- `id`: slug estável (usado como chave em relatórios). Imutável.
- `query`: string da consulta exata.
- `description`: o que o usuário esperava encontrar (livre).
- `category`: tag livre (`termo-juridico-especifico`, `pergunta-conceitual`, `numero-de-acordao`, etc.) — útil para segmentar métricas depois.
- `difficulty`: `easy` | `medium` | `hard` — autodeclarado pelo anotador.
- `annotations.relevant`: array de `documentId`s (string) considerados relevantes (relevance grade = 1).
- `annotations.highlyRelevant`: subset de `relevant`, marcados como **a melhor resposta** (relevance grade = 2). Usado pelo nDCG.
- `annotations.annotatedAt` / `annotatedBy` / `notes`: metadados de auditoria.

**Estado de uma query:**
- *Não anotada*: `annotations.relevant.length === 0` AND `annotatedAt === null`. Runner pula essas queries com warning, mas o framework tolera para permitir que o golden set cresça incrementalmente.
- *Anotada*: pelo menos um doc em `relevant`. Métricas são computadas.

---

## Métricas (definições exatas)

Para cada query anotada, dado um ranking previsto `predicted: string[]` (lista de documentIds em ordem) e ground truth `relevant: Set<string>` + `highlyRelevant: Set<string>`:

**recall@k** = |predicted[0..k] ∩ relevant| / |relevant|

**Reciprocal Rank** = 1 / (1-based index do primeiro item de `predicted` que está em `relevant`); 0 se nenhum.
**MRR** = média de reciprocal rank sobre todas as queries anotadas.

**nDCG@k**: ganho de relevância graduado. Grade = 2 se highlyRelevant, 1 se relevant-only, 0 caso contrário.
- DCG@k = Σ_{i=1..k} (2^grade_i - 1) / log₂(i + 1)
- IDCG@k = DCG@k do ranking ideal (todos os highlyRelevant primeiro, depois relevant-only).
- nDCG@k = DCG@k / IDCG@k (1.0 se IDCG = 0 → trata como skipped, não como zero, para não viesar a média).

**Sumário agregado:**
- `recallAt5_avg`, `mrr`, `ndcgAt10_avg`
- Por dificuldade: mesma tripla segmentada por `easy/medium/hard`
- `queriesAnnotated`, `queriesSkipped`, `queriesTotal`

---

## Pré-requisitos

- Node + npm instalados; worktree em `C:/Projeto de site do Barral/sitedobarral-eval/` checked out em `feat/eval-framework`
- `npm install` rodado no worktree (deve estar concluído quando o implementer começar)
- `.env.local` com `GEMINI_API_KEY` e `DATABASE_URL` populados (eval roda chamadas reais à busca, que faz queries vetoriais ao Neon e gera embeddings via Gemini — não há mock disso)

**`@inquirer/prompts`** ainda não está nas dependências. Será adicionado na Task 5 (CLI interativa). É a lib-padrão para prompts CLI em TS, leve, mantida pela mesma equipe do antigo Inquirer.js.

---

## Task 1: Tipos + golden set semente

**Files:**
- Create: `eval/types.ts`
- Create: `eval/golden-set.json`

- [ ] **Step 1: Criar `eval/types.ts`**

```ts
/**
 * Tipos do framework de avaliação de busca.
 * Não imports — tipos puros para serem reutilizados por metrics, runner e CLIs.
 */

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GoldenAnnotations {
  /** documentIds considerados relevantes (grade 1). */
  relevant: string[]
  /** Subset de `relevant`, marcados como a melhor resposta (grade 2). */
  highlyRelevant: string[]
  /** ISO date string ou null se ainda não anotada. */
  annotatedAt: string | null
  annotatedBy: string | null
  /** Anotações livres do curador. */
  notes: string
}

export interface GoldenQuery {
  id: string
  query: string
  description: string
  category: string
  difficulty: Difficulty
  annotations: GoldenAnnotations
}

export interface GoldenSet {
  version: 1
  createdAt: string
  queries: GoldenQuery[]
}

/** Resultado de uma única query avaliada. */
export interface QueryEvalResult {
  id: string
  query: string
  difficulty: Difficulty
  predicted: string[]
  recallAt5: number
  reciprocalRank: number
  ndcgAt10: number | null // null se IDCG = 0 (skipped no agregado)
  latencyMs: number
}

/** Sumário agregado sobre múltiplas queries. */
export interface MetricSummary {
  queriesTotal: number
  queriesAnnotated: number
  queriesSkipped: number
  recallAt5_avg: number
  mrr: number
  ndcgAt10_avg: number
  byDifficulty: Record<Difficulty, {
    count: number
    recallAt5_avg: number
    mrr: number
    ndcgAt10_avg: number
  }>
}

export interface EvalRun {
  runAt: string
  gitSha: string
  summary: MetricSummary
  perQuery: QueryEvalResult[]
}

/** Função que recebe uma query e devolve documentIds em ordem de ranking. */
export type SearchFn = (query: string) => Promise<{
  documentIds: string[]
  latencyMs: number
}>
```

- [ ] **Step 2: Criar `eval/golden-set.json` com a query semente**

```json
{
  "version": 1,
  "createdAt": "2026-04-06",
  "queries": [
    {
      "id": "q-data-a-data",
      "query": "sistema data a data",
      "description": "Termo técnico para contagem de prazo de vigência de contratos. Citado expressamente no art. 183, II da Lei 14.133/2021.",
      "category": "termo-juridico-especifico",
      "difficulty": "hard",
      "annotations": {
        "relevant": [],
        "highlyRelevant": [],
        "annotatedAt": null,
        "annotatedBy": null,
        "notes": "Hoje a busca devolve resposta sobre reajuste de preços (art. 134, 182, 124) — completamente fora do tópico. O documento certo é o art. 183 II da Lei 14.133. Anotar via CLI eval:annotate quando o framework estiver pronto."
      }
    }
  ]
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "eval/" || echo "no errors in eval/"`
Expected: `no errors in eval/`. (`eval/` precisa estar incluído no tsconfig — o `include` atual é `**/*.ts`, então deve pegar automaticamente.)

- [ ] **Step 4: Commit**

```bash
git add eval/types.ts eval/golden-set.json
git commit -m "feat(eval): add golden set schema and seed query"
```

---

## Task 2: Métricas (TDD)

**Files:**
- Create: `lib/__tests__/eval/metrics.test.ts`
- Create: `eval/metrics.ts`

- [ ] **Step 1: Escrever testes ANTES da implementação**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { recallAtK, reciprocalRank, ndcgAtK } from '@/eval/metrics'

describe('recallAtK', () => {
  it('returns 1.0 when all relevant items are in top-k', () => {
    expect(recallAtK(['a', 'b', 'c', 'd', 'e'], new Set(['a', 'c']), 5)).toBe(1.0)
  })

  it('returns 0.5 when half the relevant items are in top-k', () => {
    expect(recallAtK(['a', 'x', 'y', 'z', 'w'], new Set(['a', 'b']), 5)).toBe(0.5)
  })

  it('returns 0 when no relevant items are in top-k', () => {
    expect(recallAtK(['x', 'y', 'z'], new Set(['a', 'b']), 5)).toBe(0)
  })

  it('returns 0 when relevant set is empty (avoid div by zero)', () => {
    expect(recallAtK(['a'], new Set(), 5)).toBe(0)
  })

  it('caps at top-k even if more relevant items appear later', () => {
    // Item 'b' relevant está na posição 6, fora do top-5
    expect(recallAtK(['a', 'x', 'y', 'z', 'w', 'b'], new Set(['a', 'b']), 5)).toBe(0.5)
  })
})

describe('reciprocalRank', () => {
  it('returns 1.0 when first item is relevant', () => {
    expect(reciprocalRank(['a', 'b', 'c'], new Set(['a']))).toBe(1.0)
  })

  it('returns 0.5 when second item is the first relevant', () => {
    expect(reciprocalRank(['x', 'a', 'b'], new Set(['a']))).toBe(0.5)
  })

  it('returns 0 when no relevant item is in the ranking', () => {
    expect(reciprocalRank(['x', 'y', 'z'], new Set(['a']))).toBe(0)
  })

  it('returns rank of first match even if others appear later', () => {
    expect(reciprocalRank(['x', 'a', 'b', 'c'], new Set(['b', 'c']))).toBeCloseTo(1 / 3)
  })
})

describe('ndcgAtK', () => {
  it('returns 1.0 when ranking is perfect (highly relevant first)', () => {
    const predicted = ['hr1', 'hr2', 'r1', 'x', 'y']
    const relevant = new Set(['hr1', 'hr2', 'r1'])
    const highlyRelevant = new Set(['hr1', 'hr2'])
    expect(ndcgAtK(predicted, relevant, highlyRelevant, 10)).toBeCloseTo(1.0)
  })

  it('returns null when there are no relevant items (IDCG = 0)', () => {
    expect(ndcgAtK(['a'], new Set(), new Set(), 10)).toBeNull()
  })

  it('penalizes when relevant items appear later in ranking', () => {
    const perfect = ndcgAtK(['a', 'b', 'x', 'y'], new Set(['a', 'b']), new Set(), 10)!
    const worse = ndcgAtK(['x', 'y', 'a', 'b'], new Set(['a', 'b']), new Set(), 10)!
    expect(perfect).toBeGreaterThan(worse)
    expect(perfect).toBeCloseTo(1.0)
  })

  it('weights highly relevant items more than relevant items', () => {
    const hrFirst = ndcgAtK(['hr', 'r'], new Set(['hr', 'r']), new Set(['hr']), 10)!
    const rFirst = ndcgAtK(['r', 'hr'], new Set(['hr', 'r']), new Set(['hr']), 10)!
    expect(hrFirst).toBeGreaterThan(rFirst)
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falham**

Run: `cd "C:/Projeto de site do Barral/sitedobarral-eval" && npx vitest run lib/__tests__/eval/metrics.test.ts 2>&1 | tail -20`
Expected: erro de import (`Cannot find module '@/eval/metrics'`) ou todas falhando. Esse é o ponto vermelho do TDD.

- [ ] **Step 3: Implementar `eval/metrics.ts` minimamente para passar**

```ts
/**
 * Métricas de qualidade de retrieval — funções puras, sem I/O.
 */

/**
 * recall@k = |predicted[0..k] ∩ relevant| / |relevant|
 * Retorna 0 se relevant está vazio (em vez de NaN).
 */
export function recallAtK(predicted: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0
  const topK = predicted.slice(0, k)
  let hits = 0
  for (const id of topK) {
    if (relevant.has(id)) hits++
  }
  return hits / relevant.size
}

/**
 * Reciprocal rank: 1 / (1-based index do primeiro item de `predicted` em `relevant`).
 * Retorna 0 se nenhum item relevante aparece.
 */
export function reciprocalRank(predicted: string[], relevant: Set<string>): number {
  for (let i = 0; i < predicted.length; i++) {
    if (relevant.has(predicted[i])) {
      return 1 / (i + 1)
    }
  }
  return 0
}

/**
 * nDCG@k com gain graduado (highly relevant = 2, relevant = 1, outros = 0).
 * Fórmula DCG: Σ (2^gain - 1) / log₂(i + 2) para i 0-based.
 * Retorna null se IDCG = 0 (sem itens relevantes — não computar para evitar viés no agregado).
 */
export function ndcgAtK(
  predicted: string[],
  relevant: Set<string>,
  highlyRelevant: Set<string>,
  k: number
): number | null {
  const gain = (id: string): number => {
    if (highlyRelevant.has(id)) return 2
    if (relevant.has(id)) return 1
    return 0
  }

  // DCG do ranking previsto
  let dcg = 0
  const topK = predicted.slice(0, k)
  for (let i = 0; i < topK.length; i++) {
    const g = gain(topK[i])
    if (g > 0) {
      dcg += (Math.pow(2, g) - 1) / Math.log2(i + 2)
    }
  }

  // IDCG = DCG do ranking ideal
  const idealGains: number[] = []
  for (const id of highlyRelevant) idealGains.push(2)
  for (const id of relevant) {
    if (!highlyRelevant.has(id)) idealGains.push(1)
  }
  idealGains.sort((a, b) => b - a)

  let idcg = 0
  for (let i = 0; i < Math.min(k, idealGains.length); i++) {
    idcg += (Math.pow(2, idealGains[i]) - 1) / Math.log2(i + 2)
  }

  if (idcg === 0) return null
  return dcg / idcg
}
```

- [ ] **Step 4: Rodar testes — devem passar todos**

Run: `cd "C:/Projeto de site do Barral/sitedobarral-eval" && npx vitest run lib/__tests__/eval/metrics.test.ts 2>&1 | tail -20`
Expected: todos passed (recallAtK: 5, reciprocalRank: 4, ndcgAtK: 4 = 13 total).

- [ ] **Step 5: Commit**

```bash
git add eval/metrics.ts lib/__tests__/eval/metrics.test.ts
git commit -m "feat(eval): add retrieval metrics (recall@k, MRR, nDCG@k) with tests"
```

---

## Task 3: Adapter para o `hybridSearch` existente

**Files:**
- Create: `eval/search-adapter.ts`

- [ ] **Step 1: Criar adapter**

```ts
import { hybridSearch } from '@/lib/embeddings/hybrid-search'
import type { SearchFn } from './types'

/**
 * Adapter que envolve `hybridSearch` na interface SearchFn esperada pelo runner.
 *
 * Decisões:
 * - `limit: 20` — pega top-20 para ter espaço para nDCG@10 e recall@5 sem cortar.
 * - `useCache: false` — eval deve refletir comportamento "frio" do sistema.
 * - Sem filtro de curso/categoria — golden set assume busca global.
 * - Deduplica por documentId mantendo a primeira ocorrência (chunks do mesmo doc
 *   aparecem em sequência; a métrica é por documento, não por chunk).
 */
export const baselineSearch: SearchFn = async (query: string) => {
  const start = Date.now()
  const response = await hybridSearch({
    query,
    limit: 20,
    useCache: false,
  })
  const latencyMs = Date.now() - start

  const seen = new Set<string>()
  const documentIds: string[] = []
  for (const r of response.results) {
    if (!seen.has(r.documentId)) {
      seen.add(r.documentId)
      documentIds.push(r.documentId)
    }
  }

  return { documentIds, latencyMs }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "C:/Projeto de site do Barral/sitedobarral-eval" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "eval/search-adapter" || echo "no errors in target file"`
Expected: `no errors in target file`.

- [ ] **Step 3: Commit**

```bash
git add eval/search-adapter.ts
git commit -m "feat(eval): add baseline search adapter wrapping hybridSearch"
```

---

## Task 4: Runner

**Files:**
- Create: `eval/runner.ts`

- [ ] **Step 1: Criar runner**

```ts
import { execSync } from 'node:child_process'
import { recallAtK, reciprocalRank, ndcgAtK } from './metrics'
import type {
  GoldenSet,
  GoldenQuery,
  QueryEvalResult,
  MetricSummary,
  EvalRun,
  SearchFn,
  Difficulty,
} from './types'

/**
 * Avalia uma única query anotada. Retorna null se a query não está anotada
 * (sem itens em `relevant`).
 */
async function evalQuery(q: GoldenQuery, search: SearchFn): Promise<QueryEvalResult | null> {
  if (q.annotations.relevant.length === 0) return null

  const relevant = new Set(q.annotations.relevant)
  const highlyRelevant = new Set(q.annotations.highlyRelevant)

  const { documentIds, latencyMs } = await search(q.query)

  return {
    id: q.id,
    query: q.query,
    difficulty: q.difficulty,
    predicted: documentIds,
    recallAt5: recallAtK(documentIds, relevant, 5),
    reciprocalRank: reciprocalRank(documentIds, relevant),
    ndcgAt10: ndcgAtK(documentIds, relevant, highlyRelevant, 10),
    latencyMs,
  }
}

/**
 * Avalia o golden set inteiro contra uma função de busca.
 * Pula queries não anotadas (incluídas em queriesSkipped).
 */
export async function runEval(goldenSet: GoldenSet, search: SearchFn): Promise<EvalRun> {
  const perQuery: QueryEvalResult[] = []
  let skipped = 0

  for (const q of goldenSet.queries) {
    const result = await evalQuery(q, search)
    if (result === null) {
      skipped++
    } else {
      perQuery.push(result)
    }
  }

  return {
    runAt: new Date().toISOString(),
    gitSha: getGitSha(),
    summary: aggregate(perQuery, goldenSet.queries.length, skipped),
    perQuery,
  }
}

function aggregate(
  results: QueryEvalResult[],
  total: number,
  skipped: number
): MetricSummary {
  const annotated = results.length

  const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
  const ndcgValues = results.map((r) => r.ndcgAt10).filter((v): v is number => v !== null)

  const byDifficulty = {
    easy: subset(results, 'easy'),
    medium: subset(results, 'medium'),
    hard: subset(results, 'hard'),
  }

  return {
    queriesTotal: total,
    queriesAnnotated: annotated,
    queriesSkipped: skipped,
    recallAt5_avg: avg(results.map((r) => r.recallAt5)),
    mrr: avg(results.map((r) => r.reciprocalRank)),
    ndcgAt10_avg: avg(ndcgValues),
    byDifficulty,
  }
}

function subset(results: QueryEvalResult[], d: Difficulty) {
  const filtered = results.filter((r) => r.difficulty === d)
  const avg = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
  const ndcgValues = filtered.map((r) => r.ndcgAt10).filter((v): v is number => v !== null)
  return {
    count: filtered.length,
    recallAt5_avg: avg(filtered.map((r) => r.recallAt5)),
    mrr: avg(filtered.map((r) => r.reciprocalRank)),
    ndcgAt10_avg: avg(ndcgValues),
  }
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "C:/Projeto de site do Barral/sitedobarral-eval" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "eval/runner" || echo "no errors in target file"`
Expected: `no errors in target file`.

- [ ] **Step 3: Commit**

```bash
git add eval/runner.ts
git commit -m "feat(eval): add eval runner with aggregation and per-difficulty breakdown"
```

---

## Task 5: Reporter (markdown)

**Files:**
- Create: `eval/report.ts`

- [ ] **Step 1: Criar formatter**

```ts
import type { EvalRun } from './types'

/**
 * Formata um EvalRun como markdown legível, ideal para commitar em eval/reports/.
 */
export function formatReport(run: EvalRun, label: string): string {
  const s = run.summary
  const pct = (n: number) => (n * 100).toFixed(1) + '%'
  const num = (n: number) => n.toFixed(3)

  const lines: string[] = []
  lines.push(`# Eval Run — ${label}`)
  lines.push('')
  lines.push(`- **Run at:** ${run.runAt}`)
  lines.push(`- **Git SHA:** \`${run.gitSha}\``)
  lines.push(`- **Queries:** ${s.queriesAnnotated} annotated / ${s.queriesTotal} total (${s.queriesSkipped} skipped)`)
  lines.push('')
  lines.push('## Aggregate metrics')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|---|---|')
  lines.push(`| Recall@5 (avg) | ${pct(s.recallAt5_avg)} |`)
  lines.push(`| MRR | ${num(s.mrr)} |`)
  lines.push(`| nDCG@10 (avg) | ${num(s.ndcgAt10_avg)} |`)
  lines.push('')
  lines.push('## By difficulty')
  lines.push('')
  lines.push('| Difficulty | N | Recall@5 | MRR | nDCG@10 |')
  lines.push('|---|---|---|---|---|')
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const b = s.byDifficulty[d]
    lines.push(`| ${d} | ${b.count} | ${pct(b.recallAt5_avg)} | ${num(b.mrr)} | ${num(b.ndcgAt10_avg)} |`)
  }
  lines.push('')
  lines.push('## Per-query results')
  lines.push('')
  lines.push('| ID | Query | Difficulty | Recall@5 | RR | nDCG@10 | Latency (ms) |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const r of run.perQuery) {
    const ndcg = r.ndcgAt10 === null ? '—' : num(r.ndcgAt10)
    const queryEsc = r.query.replace(/\|/g, '\\|')
    lines.push(`| \`${r.id}\` | ${queryEsc} | ${r.difficulty} | ${pct(r.recallAt5)} | ${num(r.reciprocalRank)} | ${ndcg} | ${r.latencyMs} |`)
  }
  lines.push('')
  return lines.join('\n')
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd "C:/Projeto de site do Barral/sitedobarral-eval" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "eval/report" || echo "no errors in target file"`
Expected: `no errors in target file`.

```bash
git add eval/report.ts
git commit -m "feat(eval): add markdown reporter"
```

---

## Task 6: CLI `run-baseline`

**Files:**
- Create: `eval/cli/run-baseline.ts`
- Create: `eval/reports/.gitkeep`

- [ ] **Step 1: Criar a CLI**

```ts
/**
 * Roda o eval contra o golden set atual usando o `baselineSearch` adapter
 * e escreve um relatório markdown em eval/reports/.
 *
 * Uso:
 *   tsx eval/cli/run-baseline.ts [--label "minha-rodada"]
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { baselineSearch } from '../search-adapter'
import { runEval } from '../runner'
import { formatReport } from '../report'
import type { GoldenSet } from '../types'

async function main() {
  const args = process.argv.slice(2)
  const labelIdx = args.indexOf('--label')
  const label = labelIdx >= 0 ? args[labelIdx + 1] : 'baseline'

  const goldenSetPath = join(process.cwd(), 'eval/golden-set.json')
  const raw = readFileSync(goldenSetPath, 'utf8')
  const goldenSet: GoldenSet = JSON.parse(raw)

  console.log(`[eval] Loaded ${goldenSet.queries.length} queries`)
  console.log(`[eval] Running search adapter against each annotated query...`)

  const run = await runEval(goldenSet, baselineSearch)

  console.log(`[eval] ${run.summary.queriesAnnotated} evaluated, ${run.summary.queriesSkipped} skipped (not annotated)`)
  console.log(`[eval] recall@5=${(run.summary.recallAt5_avg * 100).toFixed(1)}% mrr=${run.summary.mrr.toFixed(3)} ndcg@10=${run.summary.ndcgAt10_avg.toFixed(3)}`)

  const reportsDir = join(process.cwd(), 'eval/reports')
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `${stamp}_${label}.md`
  const fullPath = join(reportsDir, filename)
  writeFileSync(fullPath, formatReport(run, label), 'utf8')

  console.log(`[eval] Report written to eval/reports/${filename}`)
}

main().catch((err) => {
  console.error('[eval] FAILED:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Criar `.gitkeep` para o diretório de reports**

```bash
mkdir -p "C:/Projeto de site do Barral/sitedobarral-eval/eval/reports" && touch "C:/Projeto de site do Barral/sitedobarral-eval/eval/reports/.gitkeep"
```

- [ ] **Step 3: Typecheck**

Run: `cd "C:/Projeto de site do Barral/sitedobarral-eval" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "eval/cli/run-baseline" || echo "no errors in target file"`
Expected: `no errors in target file`.

- [ ] **Step 4: Commit**

```bash
git add eval/cli/run-baseline.ts eval/reports/.gitkeep
git commit -m "feat(eval): add run-baseline CLI"
```

---

## Task 7: CLI `annotate` (interativa)

**Files:**
- Modify: `package.json` (adicionar `@inquirer/prompts` em dependencies)
- Create: `eval/cli/annotate.ts`

- [ ] **Step 1: Instalar `@inquirer/prompts`**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-eval" && npm install @inquirer/prompts
```

Expected: instala sem erros, atualiza `package.json` e `package-lock.json`.

- [ ] **Step 2: Criar a CLI**

```ts
/**
 * CLI interativa para anotar o golden set.
 *
 * Modos:
 *   tsx eval/cli/annotate.ts                       — lista queries não anotadas, escolhe uma
 *   tsx eval/cli/annotate.ts --id q-data-a-data    — anota uma query específica
 *   tsx eval/cli/annotate.ts --new                 — cria uma nova query do zero
 *
 * Para modo --id (e seleção da lista): roda baselineSearch, mostra top-10 com título +
 * trecho, usuário marca cada um como (h)ighly relevant, (r)elevant ou (n)othing.
 * Salva em eval/golden-set.json.
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { select, input, confirm, checkbox } from '@inquirer/prompts'
import { hybridSearch } from '@/lib/embeddings/hybrid-search'
import type { GoldenSet, GoldenQuery, Difficulty } from '../types'

const GOLDEN_PATH = join(process.cwd(), 'eval/golden-set.json')

function loadGoldenSet(): GoldenSet {
  return JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))
}

function saveGoldenSet(gs: GoldenSet): void {
  writeFileSync(GOLDEN_PATH, JSON.stringify(gs, null, 2) + '\n', 'utf8')
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
  top.forEach((r, i) => {
    console.log(`[${i + 1}] (${r.category}) ${r.documentTitle}`)
    console.log(`     ID: ${r.documentId}`)
    console.log(`     ${r.chunkContent.slice(0, 200).replace(/\s+/g, ' ')}...`)
    console.log()
  })

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

  // Etapa 3: também aceita IDs colados manualmente (caso o doc certo não esteja no top-10)
  const addManual = await confirm({
    message: 'Quer adicionar IDs de documentos relevantes que NÃO estavam no top-10?',
    default: false,
  })
  if (addManual) {
    const ids = await input({
      message: 'Cole os documentIds separados por vírgula:',
    })
    const extras = ids.split(',').map((s) => s.trim()).filter(Boolean)
    relevant.push(...extras)
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
      name: `${q.annotations.relevant.length === 0 ? '[ ]' : '[x]'} ${q.id} — ${q.query}`,
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
```

- [ ] **Step 3: Typecheck**

Run: `cd "C:/Projeto de site do Barral/sitedobarral-eval" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "eval/cli/annotate" || echo "no errors in target file"`
Expected: `no errors in target file`.

- [ ] **Step 4: Commit**

```bash
git add eval/cli/annotate.ts package.json package-lock.json
git commit -m "feat(eval): add interactive annotate CLI with @inquirer/prompts"
```

---

## Task 8: README + npm scripts + smoke test

**Files:**
- Create: `eval/README.md`
- Modify: `package.json`

- [ ] **Step 1: Adicionar npm scripts ao `package.json`**

Localizar o bloco `"scripts": { ... }` em `package.json` e adicionar (mantendo os existentes intactos):

```json
"eval:annotate": "tsx eval/cli/annotate.ts",
"eval:run": "tsx eval/cli/run-baseline.ts"
```

(coloque após `"test:watch": "vitest --watch",` ou em qualquer posição que mantenha o JSON válido — separar com vírgulas onde apropriado)

- [ ] **Step 2: Criar `eval/README.md`**

```markdown
# Eval Framework

Mede a qualidade do retrieval da busca jurídica do site usando um golden set
curado e três métricas padrão.

## Conceito

- **Golden set** (`golden-set.json`): conjunto de queries representativas com
  documentos relevantes anotados manualmente.
- **Metrics**: recall@5, MRR, nDCG@10 — calculadas por query e agregadas.
- **Reports**: cada execução escreve um markdown em `reports/`. Commitar para
  ter timeline visível de melhorias/regressões.

Esta fase mede SÓ retrieval (ranking de documentos). A qualidade do texto
sintetizado pela LLM (alucinações) é assunto de uma fase futura (LLM-as-judge).

## Comandos

```bash
# Anotar (interativo) — lista queries existentes, escolhe uma
npm run eval:annotate

# Anotar uma query específica
npm run eval:annotate -- --id q-data-a-data

# Criar uma query nova do zero
npm run eval:annotate -- --new

# Rodar o eval e gerar relatório
npm run eval:run

# Rodar com label customizado (vai pro nome do arquivo)
npm run eval:run -- --label "antes-rerank-cohere"
```

## Workflow para construir o golden set inicial

1. Use `npm run eval:annotate -- --new` para criar suas 50 queries (ou comece com as 5-10 que mais te incomodam).
2. Para cada query, o CLI roda a busca atual e mostra o top-10. Marque os relevantes que aparecerem.
3. Se a resposta correta NÃO estiver no top-10, cole o documentId manualmente quando perguntado — a meta é capturar a verdade-de-base, não o que o sistema atual encontra.
4. Quando tiver ~10 queries anotadas, rode `npm run eval:run -- --label "baseline"` para tirar a primeira foto.

## Métricas — interpretação rápida

- **recall@5**: alto = a info certa chega ao usuário no top-5. < 60% = problema sério de retrieval.
- **MRR**: alto = a melhor resposta vem cedo no ranking. < 0.5 = ranking ruim.
- **nDCG@10**: combina relevância graduada (highly relevant pesa 2x). 1.0 = ranking perfeito; ≥ 0.8 é bom.

## O que NÃO está aqui (yet)

- Avaliação da síntese (texto gerado pela LLM)
- LLM-as-judge para queries sem ground truth
- Cobertura de `lei-14133/search` separadamente
```

- [ ] **Step 3: Smoke test do framework**

Rodar `npm run eval:run` (mesmo sem queries anotadas) só para confirmar que o framework não explode:

```bash
cd "C:/Projeto de site do Barral/sitedobarral-eval" && npm run eval:run 2>&1 | tail -20
```

Expected:
- `Loaded 1 queries`
- `0 evaluated, 1 skipped (not annotated)`
- `recall@5=0.0% mrr=0.000 ndcg@10=0.000` (todos zero porque agregado de zero amostras)
- Report escrito em `eval/reports/`

Se falhar com erro de DB (sem `.env.local` neste worktree), pode ser aceitável reportar como concern — o smoke test só estará completo se você tiver `.env.local` configurado no worktree. NÃO crie um `.env.local` falso só pra fazer passar.

- [ ] **Step 4: Commit do report (se gerado) e do README**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-eval" && git add eval/README.md package.json eval/reports/ && git commit -m "docs(eval): add README, npm scripts, and initial smoke run"
```

---

## Task 9: Verificação final + docs no CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rodar suíte completa**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-eval" && npm run test:run 2>&1 | tail -20
```

Expected: 13 testes novos do `metrics.test.ts` passam; resto da suíte sem regressões. Falhas pré-existentes em `lib/cache/__tests__/redis-client.test.ts` continuam aceitáveis.

- [ ] **Step 2: Lint**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-eval" && npm run lint 2>&1 | tail -30
```

Acceptance: zero novos warnings/errors em `eval/` ou `lib/__tests__/eval/`.

- [ ] **Step 3: Build**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-eval" && npm run build 2>&1 | tail -20
```

Acceptance: build conclui. As CLIs de eval (`tsx eval/cli/...`) NÃO devem ser empacotadas pelo Next — verificar se algum erro de build menciona `eval/`. Se Next tentar bundlar e falhar, adicionar `eval/` ao `next.config.ts` em `pageExtensions` ou criar `eval/.next-ignore` (na verdade, Next só bundla `app/`, `pages/` e arquivos importados a partir deles — `eval/` não é importado por nada do app, então deve ficar fora naturalmente).

- [ ] **Step 4: Adicionar seção ao `CLAUDE.md`**

Localizar o `CLAUDE.md` na raiz e adicionar antes de "Notes for Future Claude Instances":

```markdown
## Eval framework (`eval/`)

Framework de avaliação de qualidade de retrieval da busca jurídica.

- Golden set em `eval/golden-set.json`
- Métricas: recall@5, MRR, nDCG@10
- CLIs: `npm run eval:annotate` (interativo) e `npm run eval:run` (gera relatório)
- Reports versionados em `eval/reports/`

Ver `eval/README.md` para detalhes. Esta fase mede só retrieval — síntese da LLM
fica para fase futura.
```

- [ ] **Step 5: Diff final + commit**

```bash
cd "C:/Projeto de site do Barral/sitedobarral-eval" && git diff origin/main --stat
```

Confirmar que mudanças cobrem só:
- `eval/**` (vários arquivos novos)
- `lib/__tests__/eval/metrics.test.ts` (novo)
- `package.json` + `package-lock.json` (modified — só `@inquirer/prompts` e scripts)
- `CLAUDE.md` (modified)
- `docs/superpowers/plans/2026-04-06-eval-framework.md` (novo — o próprio plano)

```bash
cd "C:/Projeto de site do Barral/sitedobarral-eval" && git add CLAUDE.md && git commit -m "docs(eval): document eval framework in CLAUDE.md"
```

---

## Critérios de aceitação (Definition of Done)

- [ ] `eval/{types,metrics,search-adapter,runner,report}.ts` existem e tipo-checam
- [ ] `eval/cli/{annotate,run-baseline}.ts` existem e tipo-checam
- [ ] `eval/golden-set.json` tem a query semente `q-data-a-data`
- [ ] `lib/__tests__/eval/metrics.test.ts` passa com 13 testes verdes
- [ ] `npm run test:run` continua verde (sem novas regressões)
- [ ] `npm run lint` limpo nos arquivos novos
- [ ] `npm run build` conclui
- [ ] Smoke run de `npm run eval:run` funciona OU está documentado como bloqueado por env
- [ ] `eval/README.md` documenta uso
- [ ] `CLAUDE.md` referencia o framework
- [ ] `package.json` tem os scripts `eval:annotate` e `eval:run`

## Próxima fase (não faz parte deste plano)

**Sessão de anotação manual** (não é código — é trabalho do procurador): usar `npm run eval:annotate` para crescer o golden set de 1 query para ~30 queries iniciais. Sem isso, as métricas não têm massa estatística e as próximas fases (Fase 3: hybrid search fix, Fase 4: rerank, Fase 5: query understanding, Fase 7: síntese) não terão sinal claro de melhoria/regressão.

**Quick win paralelo já identificado:** `lib/embeddings/hybrid-search.ts:75` exclui as categorias `lei-artigo` e `ato-normativo` do canal FTS. Isso é estruturalmente o motivo de buscas por termos exatos como "data a data" não trazerem o art. 183 II. Esse fix cabe na Fase 3 e o eval framework vai medir o ganho.
