# Fase 4.1 — A/B de dimensão de embedding (768 → 1536) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir, de forma isolada e reversível, se subir o embedding Gemini de 768 para 1536 dimensões eleva recall@5 no golden set, e deixar produção pronta para migrar se o ganho bater a meta.

**Architecture:** Coluna shadow nullable `embedding1536 vector(1536)` nas 3 tabelas de chunk que o `semanticSearch` rankeia; backfill completo com o mesmo texto/chunking; um caminho de busca de eval que consulta a coluna shadow (produção intocada); comparação `baselineSearch` (768) vs `shadowSearch1536` (1536) pelas métricas puras existentes.

**Tech Stack:** Next.js/TypeScript, Prisma + adapter PrismaNeon, pgvector, `@google/genai` (Gemini embeddings), vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-07-07-fase4-embedding-dim-ab-design.md`

## Global Constraints

- **Scripts e eval SEMPRE via dotenv:** `npx dotenv -e .env.local -- tsx <arquivo>` (o banco só resolve com `.env.local`).
- **Produção intocada:** nada no caminho de retrieval de produção muda até a decisão go/no-go. Coluna shadow é nullable; o caminho de busca de produção ignora-a por default.
- **Gate verde antes de cada commit:** `npm run test:run` deve passar (lição da Fase 3: mock de runtime não é pego por `tsc`).
- **Provider único:** Gemini. Nenhum provider novo (Voyage/OpenAI) nesta iteração.
- **Dimensão-alvo fixa em 1536** (pgvector indexa ANN só até 2000 dims). 3072 fica fora.
- **Commits pequenos, trunk-based**, cada task um commit. Coautoria: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Whitelist de coluna em SQL cru:** o nome da coluna de vetor NUNCA é interpolado livre — só `'embedding'` ou `'embedding1536'` via whitelist, para não abrir injeção.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `lib/embeddings/gemini-embeddings.ts` | Gerar embeddings; ganha parâmetro de dimensão sem mudar default 768. | Modificar |
| `prisma/schema.prisma` | Declarar `embedding1536` nullable nas 3 tabelas. | Modificar |
| `prisma/migrations/<ts>_add_embedding1536_shadow/migration.sql` | `ALTER TABLE ADD COLUMN`. | Criar (via prisma) |
| `scripts/embed-shadow-1536.ts` | Backfill idempotente das 3 tabelas em 1536d. | Criar |
| `lib/embeddings/vector-search.ts` | Aceitar `embeddingColumn`/`queryDimension` e usá-los na query. | Modificar |
| `lib/embeddings/hybrid-search.ts` | Encaminhar `embeddingColumn`/`queryDimension` ao `semanticSearch`. | Modificar |
| `eval/search-adapter.ts` | Novo adapter `shadowSearch1536`. | Modificar |
| `eval/cli/run-baseline.ts` | Flag `--shadow` para rodar o adapter shadow. | Modificar |
| `eval/reports/fase4-embedding-dim-2026-07.md` | Relatório comparativo + veredito. | Criar (gerado + manual) |

---

### Task 1: Parametrizar a dimensão no wrapper de embeddings

**Files:**
- Modify: `lib/embeddings/gemini-embeddings.ts`
- Test: `lib/embeddings/__tests__/gemini-embeddings.dimension.test.ts` (Create)

**Interfaces:**
- Produces:
  - `generateEmbedding(text: string, dimension?: number): Promise<EmbeddingResult>` — default `768`.
  - `generateBatchEmbeddings(texts: string[], dimension?: number): Promise<BatchEmbeddingResult>` — default `768`.
  - `generateQueryEmbedding(query: string, dimension?: number): Promise<EmbeddingResult>` — default `768`.
  - `EmbeddingResult.dimension` reflete a dimensão pedida.

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/embeddings/__tests__/gemini-embeddings.dimension.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do SDK: devolve um vetor com o tamanho pedido em config.outputDimensionality.
const embedContent = vi.fn(async ({ config }: { config: { outputDimensionality: number } }) => ({
  embeddings: [{ values: Array.from({ length: config.outputDimensionality }, () => 0.1) }],
}))
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({ models: { embedContent } })),
}))
// withGeminiKeyFallback apenas injeta uma apiKey e executa o callback.
vi.mock('@/lib/gemini/api-key-fallback', () => ({
  withGeminiKeyFallback: (fn: (k: string) => unknown) => fn('test-key'),
}))

describe('generateEmbedding — dimensão parametrizável', () => {
  beforeEach(() => embedContent.mockClear())

  it('usa 768 por default', async () => {
    const { generateEmbedding } = await import('../gemini-embeddings')
    const r = await generateEmbedding('texto')
    expect(r.dimension).toBe(768)
    expect(r.embedding).toHaveLength(768)
    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ outputDimensionality: 768 }) }),
    )
  })

  it('respeita a dimensão 1536 quando pedida', async () => {
    const { generateEmbedding } = await import('../gemini-embeddings')
    const r = await generateEmbedding('texto', 1536)
    expect(r.dimension).toBe(1536)
    expect(r.embedding).toHaveLength(1536)
    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ outputDimensionality: 1536 }) }),
    )
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm run test:run -- gemini-embeddings.dimension`
Expected: FAIL — hoje `generateEmbedding` ignora o 2º argumento e sempre usa 768.

- [ ] **Step 3: Implementar o parâmetro `dimension`**

Em `lib/embeddings/gemini-embeddings.ts`, alterar as 3 funções para aceitar `dimension` (default `EMBEDDING_DIMENSION`) e repassar a `outputDimensionality`, retornando a dimensão usada. Padrão para `generateEmbedding`:

```typescript
export async function generateEmbedding(
  text: string,
  dimension: number = EMBEDDING_DIMENSION,
): Promise<EmbeddingResult> {
  return withGeminiKeyFallback(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: dimension },
    });
    const embedding = result.embeddings?.[0]?.values;
    if (!embedding) {
      throw new Error('No embedding returned from Gemini API');
    }
    return { embedding, model: EMBEDDING_MODEL, dimension };
  });
}
```

Aplicar a mesma mudança em `generateBatchEmbeddings(texts, dimension = EMBEDDING_DIMENSION)` (repassar `dimension` ao `outputDimensionality` no loop/batch e no retorno) e em `generateQueryEmbedding(query, dimension = EMBEDDING_DIMENSION)` (encaminhar: `return generateEmbedding(query, dimension)` se hoje ele já delega, ou repassar o `dimension` do mesmo modo).

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm run test:run -- gemini-embeddings.dimension`
Expected: PASS (2 testes).

- [ ] **Step 5: Rodar a suíte inteira (garantir zero regressão)**

Run: `npm run test:run`
Expected: verde (mesmo número de suites de antes + a nova).

- [ ] **Step 6: Commit**

```bash
git add lib/embeddings/gemini-embeddings.ts lib/embeddings/__tests__/gemini-embeddings.dimension.test.ts
git commit -m "feat(embeddings): dimensão parametrizável no wrapper Gemini (default 768)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration — colunas shadow `embedding1536`

**Files:**
- Modify: `prisma/schema.prisma` (models `DocumentChunk`, `LegislativeActChunk`, `TribunalDecisionChunk`)
- Create: `prisma/migrations/<timestamp>_add_embedding1536_shadow/migration.sql`

**Interfaces:**
- Produces: coluna `embedding1536 vector(1536)` NULL nas 3 tabelas.

- [ ] **Step 1: Declarar as colunas no schema**

Em `prisma/schema.prisma`, logo abaixo da linha `embedding Unsupported("vector(768)")` de **cada** um dos 3 models, acrescentar:

```prisma
  embedding1536 Unsupported("vector(1536)")? // Shadow A/B Fase 4.1 — nullable, ignorado em prod
```

(3 edições: `DocumentChunk` ~linha 280, `LegislativeActChunk` ~linha 826, `TribunalDecisionChunk` ~linha 1696.)

- [ ] **Step 2: Gerar a migration sem aplicar (create-only)**

Run: `npx dotenv -e .env.local -- npx prisma migrate dev --name add_embedding1536_shadow --create-only`
Expected: cria a pasta `prisma/migrations/<ts>_add_embedding1536_shadow/` com `migration.sql`.

- [ ] **Step 3: Revisar o SQL gerado**

Abrir o `migration.sql`. Deve conter apenas 3 statements do tipo:

```sql
ALTER TABLE "DocumentChunk" ADD COLUMN "embedding1536" vector(1536);
ALTER TABLE "LegislativeActChunk" ADD COLUMN "embedding1536" vector(1536);
ALTER TABLE "TribunalDecisionChunk" ADD COLUMN "embedding1536" vector(1536);
```

Se o Prisma gerar algo além de `ADD COLUMN` (ex.: DROP/recreate por causa do tipo `Unsupported`), editar o SQL manualmente para conter só os 3 `ADD COLUMN` acima e nada mais. Nenhum `NOT NULL`, nenhum índice ainda.

- [ ] **Step 4: Aplicar a migration**

Run: `npx dotenv -e .env.local -- npx prisma migrate deploy`
Expected: `Applied ... add_embedding1536_shadow`.

- [ ] **Step 5: Verificar as colunas no banco**

Run:
```bash
npx dotenv -e .env.local -- tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.\$queryRawUnsafe(\`SELECT table_name, column_name FROM information_schema.columns WHERE column_name='embedding1536' ORDER BY table_name\`).then((r:any)=>{console.log(r); return p.\$disconnect()})"
```
Expected: 3 linhas (DocumentChunk, LegislativeActChunk, TribunalDecisionChunk).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): coluna shadow embedding1536 (nullable) nas 3 tabelas de chunk

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Script de backfill shadow 1536

**Files:**
- Create: `scripts/embed-shadow-1536.ts`

**Interfaces:**
- Consumes: `generateBatchEmbeddings(texts, 1536)`, `embeddingToSql(vec)` (Task 1).
- Produces: coluna `embedding1536` preenchida em todas as linhas com `content` não nulo nas 3 tabelas.

- [ ] **Step 1: Escrever o script**

Criar `scripts/embed-shadow-1536.ts`:

```typescript
/**
 * Backfill shadow — reembeda o MESMO content das 3 tabelas de chunk em 1536d
 * na coluna embedding1536. Idempotente (só toca linhas com embedding1536 IS NULL),
 * retomável. Não altera a coluna `embedding` de produção.
 *
 * Uso: npx dotenv -e .env.local -- tsx scripts/embed-shadow-1536.ts
 */
import { PrismaClient } from '@prisma/client'
import { generateBatchEmbeddings, embeddingToSql } from '@/lib/embeddings/gemini-embeddings'

const prisma = new PrismaClient()
const DIM = 1536
const BATCH = 50
const TABLES = ['DocumentChunk', 'LegislativeActChunk', 'TribunalDecisionChunk'] as const

async function backfillTable(table: string): Promise<number> {
  let total = 0
  for (;;) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; content: string }[]>(
      `SELECT id, content FROM "${table}"
       WHERE embedding1536 IS NULL AND content IS NOT NULL AND length(content) > 0
       LIMIT ${BATCH}`,
    )
    if (rows.length === 0) break
    const { embeddings } = await generateBatchEmbeddings(rows.map((r) => r.content), DIM)
    for (let i = 0; i < rows.length; i++) {
      const vec = embeddingToSql(embeddings[i]) // string "[...]"
      await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET embedding1536 = '${vec}'::vector WHERE id = $1`,
        rows[i].id,
      )
    }
    total += rows.length
    console.log(`[${table}] +${rows.length} (acumulado ${total})`)
  }
  return total
}

async function main() {
  for (const t of TABLES) {
    console.log(`\n=== ${t} ===`)
    const n = await backfillTable(t)
    console.log(`[${t}] concluído: ${n} linhas`)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Dry-run pequeno — confirmar que grava e é idempotente**

Rodar uma vez com `LIMIT 50` (o padrão já processa em lotes de 50). Interromper com Ctrl+C após ~1 lote por tabela.

Run: `npx dotenv -e .env.local -- tsx scripts/embed-shadow-1536.ts`
Expected: logs `[DocumentChunk] +50 ...` sem erro. Rodar de novo deve pular as linhas já preenchidas (contagem inicial menor), provando idempotência.

- [ ] **Step 3: Verificar dimensão gravada**

Run:
```bash
npx dotenv -e .env.local -- tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.\$queryRawUnsafe(\`SELECT vector_dims(embedding1536) AS dims, count(*) FROM \\\"DocumentChunk\\\" WHERE embedding1536 IS NOT NULL GROUP BY 1\`).then((r:any)=>{console.log(r); return p.\$disconnect()})"
```
Expected: `dims = 1536`.

- [ ] **Step 4: Rodar o backfill completo**

Run: `npx dotenv -e .env.local -- tsx scripts/embed-shadow-1536.ts`
Expected: termina as 3 tabelas; logs de "concluído" para cada. (Tempo estimado 1–2h; se o processo cair, basta rodar de novo — retoma.)

- [ ] **Step 5: Confirmar cobertura (sem NULLs restantes)**

Run:
```bash
npx dotenv -e .env.local -- tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); (async()=>{for(const t of ['DocumentChunk','LegislativeActChunk','TribunalDecisionChunk']){const r:any=await p.\$queryRawUnsafe(\`SELECT count(*) FILTER (WHERE embedding1536 IS NULL AND length(content)>0) AS faltam, count(*) AS total FROM \\\"\${t}\\\"\`);console.log(t,r[0])} await p.\$disconnect()})()"
```
Expected: `faltam = 0` para as 3 tabelas.

- [ ] **Step 6: Commit**

```bash
git add scripts/embed-shadow-1536.ts
git commit -m "feat(scripts): backfill shadow embedding1536 nas 3 tabelas de chunk

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Caminho de busca shadow (vector-search + hybrid-search)

**Files:**
- Modify: `lib/embeddings/vector-search.ts`
- Modify: `lib/embeddings/hybrid-search.ts`
- Test: `lib/embeddings/__tests__/vector-search.shadow.test.ts` (Create)

**Interfaces:**
- Produces (opções novas, ambas opcionais, defaults preservam produção):
  - `SearchOptions.embeddingColumn?: 'embedding' | 'embedding1536'` — default `'embedding'`.
  - `SearchOptions.queryDimension?: number` — default `768`.
  - `HybridSearchOptions.embeddingColumn?` e `HybridSearchOptions.queryDimension?` — encaminhados ao `semanticSearch`.

- [ ] **Step 1: Escrever o teste que falha (whitelist da coluna)**

Criar `lib/embeddings/__tests__/vector-search.shadow.test.ts`. O objetivo é travar a whitelist (segurança) e o default. Testa a função pura de resolução de coluna que a Task exporta:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveEmbeddingColumn } from '../vector-search'

describe('resolveEmbeddingColumn — whitelist', () => {
  it('default é embedding', () => {
    expect(resolveEmbeddingColumn(undefined)).toBe('embedding')
  })
  it('aceita embedding1536', () => {
    expect(resolveEmbeddingColumn('embedding1536')).toBe('embedding1536')
  })
  it('rejeita qualquer outro valor (anti-injeção) caindo no default', () => {
    expect(resolveEmbeddingColumn('embedding; DROP TABLE x')).toBe('embedding')
    expect(resolveEmbeddingColumn('foo')).toBe('embedding')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test:run -- vector-search.shadow`
Expected: FAIL — `resolveEmbeddingColumn` ainda não existe.

- [ ] **Step 3: Implementar em `vector-search.ts`**

3a. Adicionar a helper exportada (perto do topo do arquivo, após os imports):

```typescript
/** Whitelist anti-injeção: só as duas colunas de vetor conhecidas são aceitas. */
export function resolveEmbeddingColumn(col: string | undefined): 'embedding' | 'embedding1536' {
  return col === 'embedding1536' ? 'embedding1536' : 'embedding'
}
```

3b. Em `interface SearchOptions`, acrescentar:

```typescript
  /** Coluna de vetor a usar (A/B Fase 4.1). Default 'embedding'. */
  embeddingColumn?: 'embedding' | 'embedding1536';
  /** Dimensão do embedding da query (deve casar com a coluna). Default 768. */
  queryDimension?: number;
```

3c. No ponto onde a query é embeddada (hoje `const { embedding } = await generateQueryEmbedding(query);`, ~linha 271), passar a dimensão:

```typescript
  const { embedding } = await generateQueryEmbedding(query, options.queryDimension);
```

3d. Antes de montar o SQL, resolver a coluna uma vez:

```typescript
  const vcol = resolveEmbeddingColumn(options.embeddingColumn);
```

3e. Nas 3 expressões de similaridade que hoje usam `.embedding <=>`, trocar por `.${vcol} <=>`:
- ramo DocumentChunk (`doc_scores`, ~linha 335): `1 - (c.${vcol} <=> '${embeddingStr}'::vector) as similarity`
- ramo LegislativeActChunk (`act_scores`, ~linha 370): `(1 - (lc.${vcol} <=> '${embeddingStr}'::vector)) * ...`
- ramo TribunalDecisionChunk (`decision_scores`, ~linhas 437 e 443): `1 - (tc.${vcol} <=> '${embeddingStr}'::vector)` (e a variante com boost).

> `vcol` só pode ser `'embedding'` ou `'embedding1536'` (Step 3a), então a interpolação é segura.

- [ ] **Step 4: Encaminhar no `hybrid-search.ts`**

4a. Em `interface HybridSearchOptions`, adicionar:

```typescript
  embeddingColumn?: 'embedding' | 'embedding1536';
  queryDimension?: number;
```

4b. Na construção de `vectorOptions: SearchOptions` (~linha 97), incluir os dois campos:

```typescript
  const vectorOptions: SearchOptions = {
    // ...campos existentes...
    embeddingColumn: options.embeddingColumn,
    queryDimension: options.queryDimension,
  };
```

- [ ] **Step 5: Rodar os testes**

Run: `npm run test:run -- vector-search.shadow`
Expected: PASS (3 testes).

Run: `npm run test:run`
Expected: suíte inteira verde (garante que o default `'embedding'` não alterou nenhum teste de busca existente).

- [ ] **Step 6: Smoke real contra o shadow (1 query)**

Run:
```bash
npx dotenv -e .env.local -- tsx -e "import {hybridSearch} from '@/lib/embeddings/hybrid-search'; hybridSearch({query:'segregação de funções', limit:5, alpha:0.6, useCache:false, embeddingColumn:'embedding1536', queryDimension:1536}).then((r:any)=>{console.log('n=',r.results.length, r.results.slice(0,3).map((x:any)=>x.documentId)); process.exit(0)})"
```
Expected: retorna ≥1 resultado sem erro de dimensão (prova que a query 1536 casa com a coluna 1536).

- [ ] **Step 7: Commit**

```bash
git add lib/embeddings/vector-search.ts lib/embeddings/hybrid-search.ts lib/embeddings/__tests__/vector-search.shadow.test.ts
git commit -m "feat(search): caminho de busca shadow (embeddingColumn/queryDimension) com whitelist

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Adapter de eval, rodada comparativa e relatório de decisão

**Files:**
- Modify: `eval/search-adapter.ts`
- Modify: `eval/cli/run-baseline.ts`
- Create: `eval/reports/fase4-embedding-dim-2026-07.md`

**Interfaces:**
- Consumes: `hybridSearch({ embeddingColumn: 'embedding1536', queryDimension: 1536 })` (Task 4), `dedup` (local em search-adapter.ts).
- Produces: `shadowSearch1536: SearchFn`; flag `--shadow` na CLI.

- [ ] **Step 1: Adicionar o adapter `shadowSearch1536`**

Em `eval/search-adapter.ts`, após `baselineSearch`, acrescentar (espelhando-o, mudando só a coluna/dimensão):

```typescript
/**
 * Adapter A/B Fase 4.1: hybridSearch usando a coluna shadow embedding1536.
 * Mesmos parâmetros do baseline (limit 20, alpha 0.6, sem cache) para
 * isolar a variável "dimensão do embedding".
 */
export const shadowSearch1536: SearchFn = async (query: string) => {
  const start = Date.now()
  const response = await hybridSearch({
    query,
    limit: 20,
    alpha: 0.6,
    useCache: false,
    embeddingColumn: 'embedding1536',
    queryDimension: 1536,
  })
  return { documentIds: dedup(response.results), latencyMs: Date.now() - start }
}
```

- [ ] **Step 2: Ligar a flag `--shadow` na CLI**

Em `eval/cli/run-baseline.ts`:

2a. Importar o novo adapter:

```typescript
import { baselineSearch, rerankSearch, hydeSearch, shadowSearch1536 } from '../search-adapter'
```

2b. Detectar a flag e escolher o adapter (junto da lógica de `mode` existente):

```typescript
  const useShadow = process.argv.includes('--shadow')
  const searchFn = useShadow
    ? shadowSearch1536
    : useHyde
      ? hydeSearch
      : (useRerank || useCohere)
        ? rerankSearch
        : baselineSearch
  const mode = useShadow ? 'shadow-1536' : /* expressão de mode existente */ mode
```

> Ajustar o cálculo de `mode` para incluir `'shadow-1536'` e garantir que o nome do arquivo de relatório reflita o modo (o CLI já usa `mode` no filename).

- [ ] **Step 3: Rodar o baseline (768) — âncora**

Run: `npm run eval:run`
Expected: imprime `recall@5=~66.x% ...` e escreve `eval/reports/*baseline*`. Anotar o número exato.

- [ ] **Step 4: Rodar o shadow (1536)**

Run: `npm run eval:run -- --shadow`
Expected: imprime `recall@5=... mrr=... ndcg@10=...` para o modo `shadow-1536` e escreve o relatório correspondente. Anotar os números.

- [ ] **Step 5: Escrever o relatório de decisão**

Criar `eval/reports/fase4-embedding-dim-2026-07.md` com a comparação e o veredito segundo a régua do spec (§6):

```markdown
# Fase 4.1 — A/B dimensão de embedding (768 vs 1536)

Data: 2026-07-07 · Golden: 91 queries · Adapters: baselineSearch (768) vs shadowSearch1536 (1536)

| Métrica | 768 (baseline) | 1536 (shadow) | Δ |
|---|---|---|---|
| recall@5 | <preencher> | <preencher> | <preencher> pp |
| MRR | <preencher> | <preencher> | <preencher> |
| nDCG@10 | <preencher> | <preencher> | <preencher> |

Por dificuldade (recall@5): easy/medium/hard — <preencher dos JSON dumps em eval/reports/>.

Latência média por query: 768 = <preencher> ms · 1536 = <preencher> ms.

## Veredito
Régua: migrar sse recall@5 ≥ +5pp E sem regressão em MRR.
- [ ] GO — abrir plano da migração de produção (ALTER colunas reais + reindex + re-embed + env `EMBEDDING_DIMENSION`, incluindo LeiArticleEmbedding).
- [ ] NO-GO — arquivar; reabrir a decisão de provider (Voyage) numa próxima sessão. Coluna shadow pode ser dropada.
```

Preencher os `<...>` com os números reais dos Steps 3–4 e marcar GO ou NO-GO.

- [ ] **Step 6: Gate final e commit**

Run: `npm run test:run`
Expected: verde.

```bash
git add eval/search-adapter.ts eval/cli/run-baseline.ts eval/reports/fase4-embedding-dim-2026-07.md eval/reports/
git commit -m "feat(eval): adapter shadow-1536 + rodada comparativa e relatório de decisão Fase 4.1

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Decisão pós-plano (fora do escopo de código desta iteração)

- **Se GO:** nova sessão de brainstorming/plano para a migração de produção — `ALTER` das colunas reais para 1536 (incluindo `LeiArticleEmbedding`), regeneração de índice, re-embed de produção, tudo atrás de `EMBEDDING_DIMENSION` para rollback sem deploy.
- **Se NO-GO:** dropar as colunas shadow (migration reversa) e registrar o resultado no `ROADMAP_BUSCA_QUALIDADE.md`; reabrir a trilha de provider especializado (Voyage) como próxima hipótese.

---

## Self-Review (feita)

- **Cobertura do spec:** §3 dimensão 1536 → Global Constraints + Task 2/4; §4.1 coluna shadow → Task 2; §4.2 backfill completo → Task 3; §4.3 caminho isolado → Task 4/5; §5 componentes → todos mapeados no File Structure; §6 critério → Task 5 Step 5; §7 testes → Tasks 1/4 + gate `test:run` em toda task. **Refinamento consciente:** backfill/medição em 3 tabelas (as que o `semanticSearch` rankeia), não 4; `LeiArticleEmbedding` entra só na migração de produção (documentado na seção de decisão).
- **Placeholders:** os `<preencher>` do Task 5 Step 5 são saídas de execução (números do eval), não lacunas de design — corretos.
- **Consistência de tipos:** `embeddingColumn`/`queryDimension` idênticos em `SearchOptions` e `HybridSearchOptions`; `resolveEmbeddingColumn` usado em Task 4 e testado; `shadowSearch1536` produzido no Task 5 casa com a assinatura `SearchFn` do `eval/types.ts`.
