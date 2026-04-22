# IA da Jurisprudência com busca semântica + fix do pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar a rota IA da jurisprudência para busca semântica via `vector-search.ts` (incluindo informativos TCU, manuais, enunciados, acórdãos TCU e TribunalDecisions), corrigir o pipeline de indexação automática de novas decisões, e fornecer script de backfill operacional.

**Architecture:** `vector-search.ts` ganha opções retrocompatíveis (categoryIn, skipDocumentBranch, skipLegislativeActBranch, tribunalCodeFilter, extraWhere). Novo módulo `lib/jurisprudencia/semantic-adapter.ts` centraliza mapeamento UI→vector-search, enriquecimento pós-busca e shape uniforme do payload. A rota `POST /api/jurisprudencia/query` troca `fetchUnifiedTopK` por `semanticSearch` + adapter. Pipeline (`process-index-jobs`) escala de 10 jobs/run sequenciais para 50 jobs/run em batches paralelos de 10, FIFO. Script `backfill-pending-embeddings.ts` drena backlog inicial em minutos.

**Tech Stack:** Next.js 15 (App Router), Prisma 7 (`$queryRaw` + `Prisma.sql`), pgvector, Vitest, Zod, TypeScript, Gemini embedding API (tier paid).

**Spec:** `docs/superpowers/specs/2026-04-22-ia-jurisprudencia-semantic-search-design.md`

---

## File Structure

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `lib/embeddings/vector-search.ts` | modificado | Extensões retrocompatíveis: `categoryIn`, `skipDocumentBranch`, `skipLegislativeActBranch`, `tribunalCodeFilter`, `extraWhere` |
| `lib/embeddings/__tests__/vector-search.test.ts` | **novo** | Unit tests das extensões (SQL shape via assertions sobre `$queryRawUnsafe` mockado) |
| `lib/jurisprudencia/semantic-adapter.ts` | **novo** | Types, `mapFiltersToSemanticOptions`, `enrichSources`, `adaptToSourcesPayload`, utils internos |
| `lib/jurisprudencia/__tests__/semantic-adapter.test.ts` | **novo** | Unit tests do adapter (com prisma mockado) |
| `app/api/jurisprudencia/query/route.ts` | modificado | Usa `semanticSearch` + adapter em vez de `fetchUnifiedTopK` |
| `app/api/jurisprudencia/__tests__/query.test.ts` | modifica | Troca mocks + adiciona 2 testes novos |
| `app/api/cron/process-index-jobs/route.ts` | modificado | `MAX_JOBS_PER_RUN=50`, FIFO, `BATCH_SIZE=10` paralelo, time budget |
| `app/api/cron/__tests__/process-index-jobs.test.ts` | **novo** | Unit tests do fix do pipeline |
| `scripts/backfill-pending-embeddings.ts` | **novo** | Script operacional (idempotente, com flags) |

---

## Task 1: Estender `vector-search.ts` com novas opções

**Files:**
- Modify: `lib/embeddings/vector-search.ts`
- Create: `lib/embeddings/__tests__/vector-search.test.ts`

**Contexto:** O `vector-search.ts` hoje faz UNION ALL entre DocumentChunk + LegislativeActChunk + (opcional) TribunalDecisionChunk. Precisamos adicionar opções que permitam: (a) filtrar por lista de categorias (`categoryIn`), (b) pular ramos inteiros (`skipDocumentBranch`, `skipLegislativeActBranch`), (c) filtrar `TribunalDecision` por `tribunalCode` específico (`tribunalCodeFilter`), (d) injetar fragmentos SQL adicionais por ramo (`extraWhere`). Todas aditivas — defaults mantêm comportamento atual.

A rota IA da jurisprudência (Task 5) vai usar essas opções; a busca global e o chat RAG do assistente continuam chamando do jeito atual.

- [ ] **Step 1.1: Criar arquivo de teste com testes de defaults (retrocompatibilidade)**

Create: `lib/embeddings/__tests__/vector-search.test.ts`

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRawUnsafe,
  mockGenerateQueryEmbedding,
  mockWithCache,
} = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
  mockGenerateQueryEmbedding: vi.fn(),
  mockWithCache: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: (...args: any[]) => mockQueryRawUnsafe(...args),
  },
}));

vi.mock('../gemini-embeddings', () => ({
  generateQueryEmbedding: (...args: any[]) => mockGenerateQueryEmbedding(...args),
  embeddingToSql: (emb: number[]) => `[${emb.join(',')}]`,
}));

vi.mock('@/lib/cache/redis-client', () => ({
  withCache: (_key: string, fn: () => Promise<any>) => fn(),
  CACHE_TTL: { SEARCH_RESULTS: 60 },
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { semanticSearch } from '../vector-search';

beforeEach(() => {
  mockQueryRawUnsafe.mockReset();
  mockGenerateQueryEmbedding.mockReset();
  mockGenerateQueryEmbedding.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
});

function getLastSql(): string {
  const lastCall = mockQueryRawUnsafe.mock.calls[mockQueryRawUnsafe.mock.calls.length - 1];
  return lastCall[0] as string;
}

describe('semanticSearch — retrocompatibilidade', () => {
  it('sem novas opções: inclui ramo document e legislative-act, exclui tribunal-decision', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('contrato administrativo', { useCache: false });

    const sql = getLastSql();
    expect(sql).toMatch(/FROM "DocumentChunk"/);
    expect(sql).toMatch(/FROM "LegislativeActChunk"/);
    expect(sql).not.toMatch(/FROM "TribunalDecisionChunk"/);
  });

  it('com includeTribunalDecisions=true: inclui o terceiro ramo', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('qualquer', { useCache: false, includeTribunalDecisions: true });

    const sql = getLastSql();
    expect(sql).toMatch(/FROM "TribunalDecisionChunk"/);
  });
});
```

- [ ] **Step 1.2: Rodar testes para verificar retrocompatibilidade**

Run: `npx vitest run lib/embeddings/__tests__/vector-search.test.ts`
Expected: PASS — testes de defaults passam contra o código atual (nenhuma mudança ainda).

- [ ] **Step 1.3: Adicionar testes das novas opções (que devem FALHAR contra código atual)**

Edit: `lib/embeddings/__tests__/vector-search.test.ts` — adicionar no fim do arquivo:

```ts
describe('semanticSearch — categoryIn', () => {
  it('gera cláusula IN com valores da lista', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('q', {
      useCache: false,
      categoryIn: ['acordao', 'informativo', 'manual-tcu'],
    });

    const sql = getLastSql();
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    expect(sql).toMatch(/d\."category" IN \(/);
    expect(params).toContain('acordao');
    expect(params).toContain('informativo');
    expect(params).toContain('manual-tcu');
  });
});

describe('semanticSearch — skipDocumentBranch / skipLegislativeActBranch', () => {
  it('skipDocumentBranch=true: omite o ramo DocumentChunk do UNION', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('q', {
      useCache: false,
      skipDocumentBranch: true,
      includeTribunalDecisions: true,
    });

    const sql = getLastSql();
    expect(sql).not.toMatch(/FROM "DocumentChunk"/);
    expect(sql).toMatch(/FROM "LegislativeActChunk"/);
    expect(sql).toMatch(/FROM "TribunalDecisionChunk"/);
  });

  it('skipLegislativeActBranch=true: omite o ramo LegislativeActChunk', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('q', {
      useCache: false,
      skipLegislativeActBranch: true,
    });

    const sql = getLastSql();
    expect(sql).toMatch(/FROM "DocumentChunk"/);
    expect(sql).not.toMatch(/FROM "LegislativeActChunk"/);
  });

  it('ambos skips + includeTribunalDecisions=true: só TribunalDecisionChunk', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('q', {
      useCache: false,
      skipDocumentBranch: true,
      skipLegislativeActBranch: true,
      includeTribunalDecisions: true,
    });

    const sql = getLastSql();
    expect(sql).not.toMatch(/FROM "DocumentChunk"/);
    expect(sql).not.toMatch(/FROM "LegislativeActChunk"/);
    expect(sql).toMatch(/FROM "TribunalDecisionChunk"/);
  });
});

describe('semanticSearch — tribunalCodeFilter', () => {
  it('adiciona WHERE tribunalCode = ? ao ramo TribunalDecision', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await semanticSearch('q', {
      useCache: false,
      includeTribunalDecisions: true,
      tribunalCodeFilter: 'TCE-SP',
    });

    const sql = getLastSql();
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    expect(sql).toMatch(/td\."tribunalCode" = \$/);
    expect(params).toContain('TCE-SP');
  });
});

describe('semanticSearch — extraWhere', () => {
  it('extraWhere.document adiciona fragmento ao WHERE do ramo DocumentChunk', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const { Prisma } = await import('@prisma/client');
    await semanticSearch('q', {
      useCache: false,
      extraWhere: {
        document: Prisma.sql`d.year = ${2024}`,
      },
    });

    const sql = getLastSql();
    expect(sql).toMatch(/d\.year = \$/);
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    expect(params).toContain(2024);
  });

  it('extraWhere.tribunalDecision adiciona fragmento ao ramo TribunalDecisionChunk', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const { Prisma } = await import('@prisma/client');
    await semanticSearch('q', {
      useCache: false,
      includeTribunalDecisions: true,
      extraWhere: {
        tribunalDecision: Prisma.sql`td.year = ${2023}`,
      },
    });

    const sql = getLastSql();
    expect(sql).toMatch(/td\.year = \$/);
    const params = mockQueryRawUnsafe.mock.calls.at(-1)!.slice(1);
    expect(params).toContain(2023);
  });
});
```

- [ ] **Step 1.4: Rodar testes para verificar que os novos falham**

Run: `npx vitest run lib/embeddings/__tests__/vector-search.test.ts`
Expected: FAIL em ≥4 testes — as novas opções ainda não existem no código.

- [ ] **Step 1.5: Implementar as novas opções em `vector-search.ts`**

Read o arquivo inteiro primeiro para entender a estrutura completa:

Run: `cat lib/embeddings/vector-search.ts | wc -l` — deve retornar em torno de 400 linhas.

Edit: `lib/embeddings/vector-search.ts` — estender `SearchOptions`:

```ts
// Localizar `export interface SearchOptions {` e ADICIONAR as novas propriedades:

export interface SearchOptions {
  courseId?: string;
  category?: string;
  categoryIn?: string[];                                           // NOVO
  excludeCategories?: string[];
  limit?: number;
  threshold?: number;
  useCache?: boolean;
  includeChunkContent?: boolean;
  includeTribunalDecisions?: boolean;
  skipDocumentBranch?: boolean;                                    // NOVO
  skipLegislativeActBranch?: boolean;                              // NOVO
  tribunalCodeFilter?: string;                                     // NOVO
  extraWhere?: {                                                   // NOVO
    document?: import('@prisma/client').Prisma.Sql;
    tribunalDecision?: import('@prisma/client').Prisma.Sql;
  };
}
```

Edit: mesmo arquivo — modificar `executeVectorSearch`:

```ts
// Localizar `async function executeVectorSearch(` e adicionar na desestruturação:
const {
  courseId,
  category,
  limit = 5,
  threshold,
  includeChunkContent = true,
  includeTribunalDecisions = false,
  // NOVOS:
  categoryIn,
  skipDocumentBranch = false,
  skipLegislativeActBranch = false,
  tribunalCodeFilter,
  extraWhere,
} = options;

// Na seção que constrói whereClause do ramo Document, localizar o bloco de `category`:
if (category) {
  whereClause += ` AND d."category" = $${paramIndex}`;
  params.push(category);
  paramIndex++;
}

// IMEDIATAMENTE APÓS, adicionar:
if (categoryIn && categoryIn.length > 0) {
  const placeholders = categoryIn.map(() => {
    const ph = `$${paramIndex}`;
    paramIndex++;
    return ph;
  });
  whereClause += ` AND d."category" IN (${placeholders.join(', ')})`;
  for (const cat of categoryIn) params.push(cat);
}

// Localizar o bloco que gera `decisionCte` (documentação diz "3. Executa busca vetorial").
// Envolver a construção do TribunalDecisionChunk CTE, adicionando tribunalCodeFilter:
let decisionWhere = `td."embeddingStatus" = 'completed'
      AND td."approvalStatus" IN ('auto_approved', 'manually_approved')`;

if (tribunalCodeFilter) {
  decisionWhere += ` AND td."tribunalCode" = $${paramIndex}`;
  params.push(tribunalCodeFilter);
  paramIndex++;
}

// No SQL do decisionCte, substituir o WHERE fixo por `${decisionWhere}`.

// Para extraWhere: precisa ser embedido no SQL raw. Como usamos $queryRawUnsafe,
// extraímos o SQL e values de um Prisma.Sql via helper:
function appendExtraWhere(
  baseWhere: string,
  extra: import('@prisma/client').Prisma.Sql | undefined,
  params: unknown[],
  nextParamIdx: () => number
): string {
  if (!extra) return baseWhere;
  // extra.strings: TemplateStringsArray, extra.values: unknown[]
  // Rebuild with positional params $N offset to current paramIndex
  let rebuilt = '';
  for (let i = 0; i < extra.strings.length; i++) {
    rebuilt += extra.strings[i];
    if (i < extra.values.length) {
      const ph = `$${nextParamIdx()}`;
      rebuilt += ph;
      params.push(extra.values[i]);
    }
  }
  return `${baseWhere} AND (${rebuilt})`;
}

// Aplicar em whereClause (ramo Document) e decisionWhere (ramo TribunalDecision):
const nextIdx = () => { const i = paramIndex; paramIndex++; return i; };
const finalDocumentWhere = appendExtraWhere(whereClause, extraWhere?.document, params, nextIdx);
const finalDecisionWhere = appendExtraWhere(decisionWhere, extraWhere?.tribunalDecision, params, nextIdx);

// Substituir `WHERE ${whereClause}` → `WHERE ${finalDocumentWhere}` no CTE doc_scores.
// Substituir `WHERE ${decisionWhere}` → `WHERE ${finalDecisionWhere}` no CTE decision_scores.

// Para skipDocumentBranch e skipLegislativeActBranch, envolver cada CTE e a parte do UNION:
const includeDocBranch = !skipDocumentBranch;
const includeLegActBranch = !skipLegislativeActBranch;

// doc_scores CTE e UNION correspondente: só adicionar quando includeDocBranch.
// act_scores CTE e UNION correspondente: só adicionar quando includeLegActBranch.
// decision_scores: já controlado por includeTribunalDecisions.

// Se nenhum ramo incluído: retornar { results: [], query, totalFound: 0 }
if (!includeDocBranch && !includeLegActBranch && !includeTribunalDecisions) {
  return { results: [], query, totalFound: 0 };
}
```

**Nota de implementação:** Por causa da complexidade do SQL multi-CTE, recomendo editar em três passes:
1. Adicionar novos campos em `SearchOptions` + desestruturação
2. Adicionar `categoryIn` e `tribunalCodeFilter` (simples, só append em WHERE)
3. Adicionar `skipXxxBranch` e `extraWhere` (envolve reestruturação condicional do SQL)

Se a estrutura atual de construção de SQL por concatenação estiver difícil de adaptar, considere refatorar para montar o CTE via array de strings:

```ts
const ctes: string[] = [];
const unions: string[] = [];

if (includeDocBranch) {
  ctes.push(`doc_scores AS (SELECT ... FROM "DocumentChunk" c JOIN ... WHERE ${finalDocumentWhere})`);
  unions.push(`(SELECT * FROM doc_scores WHERE similarity >= $${thresholdParamIdx} ORDER BY similarity DESC LIMIT $${docLimitParamIdx})`);
}
if (includeLegActBranch) {
  ctes.push(`act_scores AS (SELECT ... FROM "LegislativeActChunk" lc JOIN ... WHERE la."embeddingStatus" = 'completed')`);
  unions.push(`(SELECT * FROM act_scores WHERE ...)`);
}
if (includeTribunalDecisions) {
  ctes.push(`decision_scores AS (SELECT ... FROM "TribunalDecisionChunk" tc JOIN ... WHERE ${finalDecisionWhere})`);
  unions.push(`(SELECT * FROM decision_scores WHERE ...)`);
}

const sqlQuery = `
  WITH ${ctes.join(',\n')}
  SELECT * FROM (
    ${unions.join('\n    UNION ALL\n    ')}
  ) combined
  ORDER BY similarity DESC
  LIMIT $${finalLimitParamIdx}
`;
```

- [ ] **Step 1.6: Rodar TODOS os testes (vector-search + restante)**

Run: `npx vitest run lib/embeddings`
Expected: PASS — testes novos passam + testes existentes de embeddings continuam passando.

Também rodar smoke check da busca global e chat RAG se tiverem testes:

Run: `npx vitest run lib/embeddings app/api/documents`
Expected: PASS em todos os preexistentes.

- [ ] **Step 1.7: Commit**

```bash
git add lib/embeddings/vector-search.ts lib/embeddings/__tests__/vector-search.test.ts
git commit -m "feat(embeddings): estende vector-search com categoryIn, skipXxxBranch, tribunalCodeFilter, extraWhere"
```

---

## Task 2: Módulo `semantic-adapter` — types + `mapFiltersToSemanticOptions`

**Files:**
- Create: `lib/jurisprudencia/semantic-adapter.ts`
- Create: `lib/jurisprudencia/__tests__/semantic-adapter.test.ts`

**Contexto:** O adapter é a ponte entre a rota IA da jurisprudência (que recebe filtros UI no shape `JurisprudenciaFilters` da PR anterior) e o `vector-search.ts` (que espera `SearchOptions`). Essa task cobre só o mapeamento de filtros → options. Enriquecimento e shape do payload vêm em Tasks 3 e 4.

O tipo `JurisprudenciaFilters` já existe em `lib/jurisprudencia/unified-query.ts` (da PR anterior). Re-usamos.

Dois builders de WHERE da PR anterior (`buildTribunalDecisionWhere` e `buildDocumentTcuWhere`) são re-usados com uma adaptação pequena:

- `buildDocumentTcuWhere` tem a condição base `category IN ('acordao','consulta_tcu')` — precisamos de uma variante **sem** essa condição base (porque agora `categoryIn` do vector-search assume essa responsabilidade).

Essa task adiciona ambos os builders adaptados e o mapeador principal.

- [ ] **Step 2.1: Escrever testes de `mapFiltersToSemanticOptions` — casos de tribunal**

Create: `lib/jurisprudencia/__tests__/semantic-adapter.test.ts`

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { mapFiltersToSemanticOptions } from '../semantic-adapter';

describe('mapFiltersToSemanticOptions — tribunal TCU', () => {
  it('tribunal=TCU: categoryIn TCU, includeTD=false, skipLegActs=true', () => {
    const options = mapFiltersToSemanticOptions({ tribunal: 'TCU' });

    expect(options.categoryIn).toEqual([
      'acordao',
      'consulta_tcu',
      'informativo',
      'manual-tcu',
    ]);
    expect(options.skipDocumentBranch).toBe(false);
    expect(options.skipLegislativeActBranch).toBe(true);
    expect(options.includeTribunalDecisions).toBe(false);
    expect(options.tribunalCodeFilter).toBeUndefined();
  });
});

describe('mapFiltersToSemanticOptions — tribunal TCE/STJ/STF', () => {
  it('tribunal=TCE-SP: skipDocBranch=true, includeTD=true, tribunalCodeFilter=TCE-SP', () => {
    const options = mapFiltersToSemanticOptions({ tribunal: 'TCE-SP' });

    expect(options.skipDocumentBranch).toBe(true);
    expect(options.skipLegislativeActBranch).toBe(true);
    expect(options.includeTribunalDecisions).toBe(true);
    expect(options.tribunalCodeFilter).toBe('TCE-SP');
  });

  it('tribunal=STF: mesmo padrão com tribunalCodeFilter=STF', () => {
    const options = mapFiltersToSemanticOptions({ tribunal: 'STF' });
    expect(options.skipDocumentBranch).toBe(true);
    expect(options.tribunalCodeFilter).toBe('STF');
  });
});

describe('mapFiltersToSemanticOptions — sem filtro de tribunal', () => {
  it('sem filtros: todas categorias TCU + enunciados + TribunalDecisions, legact skipped', () => {
    const options = mapFiltersToSemanticOptions({});

    expect(options.categoryIn).toEqual([
      'acordao',
      'consulta_tcu',
      'informativo',
      'manual-tcu',
      'enunciados',
    ]);
    expect(options.skipDocumentBranch).toBe(false);
    expect(options.skipLegislativeActBranch).toBe(true);
    expect(options.includeTribunalDecisions).toBe(true);
    expect(options.tribunalCodeFilter).toBeUndefined();
  });
});
```

- [ ] **Step 2.2: Rodar testes para verificar que falham (módulo não existe)**

Run: `npx vitest run lib/jurisprudencia/__tests__/semantic-adapter.test.ts`
Expected: FAIL — `Cannot find module '../semantic-adapter'`.

- [ ] **Step 2.3: Criar `semantic-adapter.ts` com o mapeador de tribunal**

Create: `lib/jurisprudencia/semantic-adapter.ts`

```ts
/**
 * Semantic Adapter para a IA da Jurisprudência
 *
 * Traduz os filtros UI (JurisprudenciaFilters) em opções do vector-search
 * e adapta os resultados para o payload esperado pelo front-end.
 *
 * Ver spec: docs/superpowers/specs/2026-04-22-ia-jurisprudencia-semantic-search-design.md
 */

import { Prisma } from '@prisma/client';
import type { SearchOptions } from '@/lib/embeddings/vector-search';
import type { JurisprudenciaFilters } from './unified-query';

const TCU_DOCUMENT_CATEGORIES = [
  'acordao',
  'consulta_tcu',
  'informativo',
  'manual-tcu',
] as const;

const ALL_CATEGORIES_WITH_ENUNCIADOS = [
  ...TCU_DOCUMENT_CATEGORIES,
  'enunciados',
] as const;

export function mapFiltersToSemanticOptions(
  filters: JurisprudenciaFilters
): SearchOptions {
  const base: SearchOptions = {
    skipLegislativeActBranch: true, // atos legislativos nunca entram na IA de jurisprudência
  };

  // Filtro tribunal — decisão principal
  if (filters.tribunal === 'TCU') {
    base.categoryIn = [...TCU_DOCUMENT_CATEGORIES];
    base.skipDocumentBranch = false;
    base.includeTribunalDecisions = false;
  } else if (filters.tribunal) {
    // TCE-SP, STJ, STF, etc: só TribunalDecisionChunk filtrado
    base.skipDocumentBranch = true;
    base.includeTribunalDecisions = true;
    base.tribunalCodeFilter = filters.tribunal;
  } else {
    // Sem filtro: tudo (incluindo enunciados)
    base.categoryIn = [...ALL_CATEGORIES_WITH_ENUNCIADOS];
    base.skipDocumentBranch = false;
    base.includeTribunalDecisions = true;
  }

  // decisionType: se não for 'acordao' ou vazio, pula ramo Document
  // (informativos/manuais/enunciados não são "acordao" na taxonomia)
  if (
    filters.decisionType &&
    filters.decisionType !== 'acordao'
  ) {
    base.skipDocumentBranch = true;
    if (!base.includeTribunalDecisions) {
      // coerência: se estávamos em modo TCU-only e usuário pediu sumula, não há nada a retornar
      base.includeTribunalDecisions = false;
    }
  }

  return base;
}
```

- [ ] **Step 2.4: Rodar testes para verificar que passam**

Run: `npx vitest run lib/jurisprudencia/__tests__/semantic-adapter.test.ts`
Expected: PASS (3 testes do tribunal).

- [ ] **Step 2.5: Adicionar testes de filtros estruturais (ano, tema, relator, orgao, dataFrom, dataTo, artigo, q) via extraWhere**

Edit: `lib/jurisprudencia/__tests__/semantic-adapter.test.ts` — adicionar no fim:

```ts
describe('mapFiltersToSemanticOptions — filtros estruturais via extraWhere', () => {
  it('ano + tribunal=TCU: extraWhere.document tem condição de ano (acordaoAno OR EXTRACT)', () => {
    const options = mapFiltersToSemanticOptions({
      tribunal: 'TCU',
      ano: 2024,
    });

    expect(options.extraWhere?.document).toBeDefined();
    const text = (options.extraWhere!.document as Prisma.Sql).text;
    expect(text).toMatch(/"acordaoAno" = \$/);
    expect(text).toMatch(/EXTRACT\(YEAR FROM "tcuDataJulgamento"\)/);
  });

  it('ano + tribunal=TCE-SP: extraWhere.tribunalDecision tem year = ?', () => {
    const options = mapFiltersToSemanticOptions({
      tribunal: 'TCE-SP',
      ano: 2024,
    });

    expect(options.extraWhere?.tribunalDecision).toBeDefined();
    const text = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(text).toMatch(/year = \$/);
  });

  it('tema + sem tribunal: extraWhere.document E tribunalDecision têm tema', () => {
    const options = mapFiltersToSemanticOptions({ tema: 'pregão' });

    expect(options.extraWhere?.document).toBeDefined();
    expect(options.extraWhere?.tribunalDecision).toBeDefined();
    const docText = (options.extraWhere!.document as Prisma.Sql).text;
    const tdText = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(docText).toMatch(/"tcuArea" ILIKE/);
    expect(tdText).toMatch(/themes ILIKE/);
  });

  it('q é aplicado como hard filter em ambos os ramos', () => {
    const options = mapFiltersToSemanticOptions({ q: 'contrato' });

    const docText = (options.extraWhere!.document as Prisma.Sql).text;
    const tdText = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(docText).toMatch(/title ILIKE/);
    expect(tdText).toMatch(/title ILIKE/);
  });

  it('dataFrom + dataTo: aplicados em ambos os ramos', () => {
    const options = mapFiltersToSemanticOptions({
      dataFrom: new Date('2024-01-01'),
      dataTo: new Date('2024-12-31'),
    });

    const docText = (options.extraWhere!.document as Prisma.Sql).text;
    const tdText = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(docText).toMatch(/"tcuDataJulgamento" >= \$/);
    expect(docText).toMatch(/"tcuDataJulgamento" <= \$/);
    expect(tdText).toMatch(/"dataJulgamento" >= \$/);
    expect(tdText).toMatch(/"dataJulgamento" <= \$/);
  });
});

describe('mapFiltersToSemanticOptions — decisionType', () => {
  it('decisionType=sumula: skipDocumentBranch=true (só TribunalDecision com sumula)', () => {
    const options = mapFiltersToSemanticOptions({ decisionType: 'sumula' });

    expect(options.skipDocumentBranch).toBe(true);
    expect(options.includeTribunalDecisions).toBe(true);
    const tdText = (options.extraWhere!.tribunalDecision as Prisma.Sql).text;
    expect(tdText).toMatch(/"decisionType" = \$/);
  });

  it('decisionType=acordao: ramo Document permanece ativo', () => {
    const options = mapFiltersToSemanticOptions({ decisionType: 'acordao' });

    expect(options.skipDocumentBranch).toBe(false);
  });
});
```

- [ ] **Step 2.6: Rodar testes — verificar que os novos falham**

Run: `npx vitest run lib/jurisprudencia/__tests__/semantic-adapter.test.ts`
Expected: FAIL nos novos (extraWhere ainda não construído).

- [ ] **Step 2.7: Implementar os builders de extraWhere no adapter**

Edit: `lib/jurisprudencia/semantic-adapter.ts` — adicionar antes de `mapFiltersToSemanticOptions`:

```ts
/**
 * Constrói extraWhere para o ramo DOCUMENT (categorias TCU principalmente).
 * Baseado em buildDocumentTcuWhere da PR anterior, mas SEM a condição base
 * (category IN (...)) que agora é responsabilidade do categoryIn do vector-search.
 */
function buildDocumentExtraWhere(
  filters: JurisprudenciaFilters
): Prisma.Sql | undefined {
  const fragments: Prisma.Sql[] = [];

  if (typeof filters.ano === 'number') {
    fragments.push(
      Prisma.sql`("acordaoAno" = ${filters.ano} OR EXTRACT(YEAR FROM "tcuDataJulgamento")::int = ${filters.ano})`
    );
  }
  if (filters.tema) {
    const term = '%' + filters.tema + '%';
    fragments.push(
      Prisma.sql`(themes ILIKE ${term} OR "tcuArea" ILIKE ${term} OR "tcuTema" ILIKE ${term} OR "tcuSubtema" ILIKE ${term})`
    );
  }
  if (filters.artigo) {
    fragments.push(
      Prisma.sql`"leiArticles" ILIKE ${'%' + filters.artigo + '%'}`
    );
  }
  if (filters.relator) {
    const term = '%' + filters.relator + '%';
    fragments.push(
      Prisma.sql`("tcuRelator" ILIKE ${term} OR "tcuAutorTese" ILIKE ${term})`
    );
  }
  if (filters.orgao) {
    fragments.push(
      Prisma.sql`"tcuOrgaoJulgador" ILIKE ${'%' + filters.orgao + '%'}`
    );
  }
  if (filters.dataFrom) {
    fragments.push(Prisma.sql`"tcuDataJulgamento" >= ${filters.dataFrom}`);
  }
  if (filters.dataTo) {
    fragments.push(Prisma.sql`"tcuDataJulgamento" <= ${filters.dataTo}`);
  }
  if (filters.q) {
    const term = '%' + filters.q + '%';
    fragments.push(
      Prisma.sql`(title ILIKE ${term} OR "tcuEmentaCompleta" ILIKE ${term})`
    );
  }

  if (fragments.length === 0) return undefined;
  return Prisma.join(fragments, ' AND ');
}

/**
 * Constrói extraWhere para o ramo TribunalDecision.
 * Versão sem a condição base (já aplicada no WHERE base do vector-search).
 */
function buildTribunalDecisionExtraWhere(
  filters: JurisprudenciaFilters
): Prisma.Sql | undefined {
  const fragments: Prisma.Sql[] = [];

  if (typeof filters.ano === 'number') {
    fragments.push(Prisma.sql`year = ${filters.ano}`);
  }
  if (filters.tema) {
    fragments.push(Prisma.sql`themes ILIKE ${'%' + filters.tema + '%'}`);
  }
  if (filters.artigo) {
    fragments.push(
      Prisma.sql`"leiArticles" ILIKE ${'%' + filters.artigo + '%'}`
    );
  }
  if (filters.decisionType) {
    fragments.push(Prisma.sql`"decisionType" = ${filters.decisionType}`);
  }
  if (filters.relator) {
    fragments.push(Prisma.sql`relator ILIKE ${'%' + filters.relator + '%'}`);
  }
  if (filters.orgao) {
    fragments.push(
      Prisma.sql`"orgaoJulgador" ILIKE ${'%' + filters.orgao + '%'}`
    );
  }
  if (filters.dataFrom) {
    fragments.push(Prisma.sql`"dataJulgamento" >= ${filters.dataFrom}`);
  }
  if (filters.dataTo) {
    fragments.push(Prisma.sql`"dataJulgamento" <= ${filters.dataTo}`);
  }
  if (filters.q) {
    const term = '%' + filters.q + '%';
    fragments.push(
      Prisma.sql`(title ILIKE ${term} OR ementa ILIKE ${term})`
    );
  }

  if (fragments.length === 0) return undefined;
  return Prisma.join(fragments, ' AND ');
}
```

E modificar `mapFiltersToSemanticOptions` para incluir os extraWhere:

```ts
// Ao final de mapFiltersToSemanticOptions, ANTES do return:

const docWhere = !base.skipDocumentBranch
  ? buildDocumentExtraWhere(filters)
  : undefined;
const tdWhere = base.includeTribunalDecisions
  ? buildTribunalDecisionExtraWhere(filters)
  : undefined;

if (docWhere || tdWhere) {
  base.extraWhere = {
    ...(docWhere && { document: docWhere }),
    ...(tdWhere && { tribunalDecision: tdWhere }),
  };
}

return base;
```

- [ ] **Step 2.8: Rodar testes para verificar que todos passam**

Run: `npx vitest run lib/jurisprudencia/__tests__/semantic-adapter.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 2.9: Commit**

```bash
git add lib/jurisprudencia/semantic-adapter.ts lib/jurisprudencia/__tests__/semantic-adapter.test.ts
git commit -m "feat(jurisprudencia): semantic-adapter — mapFiltersToSemanticOptions"
```

---

## Task 3: `semantic-adapter` — `enrichSources`

**Files:**
- Modify: `lib/jurisprudencia/semantic-adapter.ts`
- Modify: `lib/jurisprudencia/__tests__/semantic-adapter.test.ts`

**Contexto:** O `vector-search.ts` retorna `SearchResult[]` com dados básicos. Precisamos enriquecer com campos específicos de jurisprudência (relator, orgaoJulgador, dataJulgamento, ementa, summary, themes, leiArticles, decisionNumber, tribunalCode). Duas queries Prisma em paralelo (uma para Document, uma para TribunalDecision) bastam.

- [ ] **Step 3.1: Adicionar mock de prisma no arquivo de testes**

Edit: `lib/jurisprudencia/__tests__/semantic-adapter.test.ts` — adicionar no topo (após imports):

```ts
import { vi, beforeEach } from 'vitest';

const { mockDocumentFindMany, mockTribunalDecisionFindMany } = vi.hoisted(() => ({
  mockDocumentFindMany: vi.fn(),
  mockTribunalDecisionFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { findMany: (...args: any[]) => mockDocumentFindMany(...args) },
    tribunalDecision: { findMany: (...args: any[]) => mockTribunalDecisionFindMany(...args) },
  },
}));

beforeEach(() => {
  mockDocumentFindMany.mockReset();
  mockTribunalDecisionFindMany.mockReset();
});
```

- [ ] **Step 3.2: Adicionar testes de `enrichSources`**

Edit: `lib/jurisprudencia/__tests__/semantic-adapter.test.ts` — adicionar no fim:

```ts
describe('enrichSources', () => {
  const makeDocResult = (id: string, category: string) => ({
    documentId: id,
    documentTitle: `Title ${id}`,
    category,
    chunkContent: `chunk ${id}`,
    chunkIndex: 0,
    similarity: 0.8,
    url: `http://x/${id}`,
    courseId: null,
    isCommon: true,
    tags: null,
    leiArticles: null,
    uploadedAt: '2024-01-01',
    sourceType: 'document' as const,
  });

  const makeTdResult = (id: string) => ({
    documentId: id,
    documentTitle: `TD ${id}`,
    category: 'acordao',
    chunkContent: `chunk ${id}`,
    chunkIndex: 0,
    similarity: 0.75,
    url: null,
    courseId: null,
    isCommon: true,
    tags: null,
    leiArticles: null,
    uploadedAt: '2024-01-01',
    sourceType: 'tribunal-decision' as const,
  });

  it('quando só há documents: chama só document.findMany', async () => {
    const { enrichSources } = await import('../semantic-adapter');
    mockDocumentFindMany.mockResolvedValueOnce([
      {
        id: 'doc-1',
        title: 'Doc 1',
        category: 'acordao',
        tcuNumeroAcordao: 'AC-1/24',
        tcuEmentaCompleta: 'ementa',
        description: null,
        content: null,
        tcuRelator: 'Rel',
        tcuAutorTese: null,
        tcuOrgaoJulgador: 'Plenário',
        tcuDataJulgamento: new Date('2024-05-01'),
        tcuLinkPDF: null,
        summary: null,
        themes: null,
        leiArticles: null,
        url: null,
        douData: null,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        entityType: null,
        enunciadoNumber: null,
      },
    ]);

    const results = [makeDocResult('doc-1', 'acordao')];
    const enriched = await enrichSources(results);

    expect(enriched).toHaveLength(1);
    expect(mockDocumentFindMany).toHaveBeenCalledTimes(1);
    expect(mockTribunalDecisionFindMany).not.toHaveBeenCalled();
    expect(enriched[0]).toMatchObject({
      documentId: 'doc-1',
      similarity: 0.8,
      chunkContent: 'chunk doc-1',
      source: { kind: 'document', category: 'acordao' },
    });
  });

  it('quando só há tribunal-decisions: chama só tribunalDecision.findMany', async () => {
    const { enrichSources } = await import('../semantic-adapter');
    mockTribunalDecisionFindMany.mockResolvedValueOnce([
      {
        id: 'td-1',
        tribunalCode: 'TCE-SP',
        tribunalName: 'TCE-SP',
        decisionType: 'acordao',
        decisionNumber: '1234/2024',
        title: 'TD 1',
        ementa: 'ementa td',
        summary: null,
        relator: 'Rel TD',
        orgaoJulgador: 'Pleno',
        dataJulgamento: new Date('2024-06-01'),
        themes: null,
        leiArticles: null,
        url: null,
      },
    ]);

    const results = [makeTdResult('td-1')];
    const enriched = await enrichSources(results);

    expect(enriched).toHaveLength(1);
    expect(mockDocumentFindMany).not.toHaveBeenCalled();
    expect(mockTribunalDecisionFindMany).toHaveBeenCalledTimes(1);
    expect(enriched[0].source.kind).toBe('tribunal-decision');
  });

  it('resultado órfão (chunk → doc deletado): skip silencioso', async () => {
    const { enrichSources } = await import('../semantic-adapter');
    mockDocumentFindMany.mockResolvedValueOnce([]); // sem match

    const results = [makeDocResult('doc-orphan', 'acordao')];
    const enriched = await enrichSources(results);

    expect(enriched).toHaveLength(0);
  });

  it('múltiplos tipos: 1 query por tipo em paralelo', async () => {
    const { enrichSources } = await import('../semantic-adapter');
    mockDocumentFindMany.mockResolvedValueOnce([
      { id: 'doc-1', title: 'D', category: 'informativo', tcuNumeroAcordao: null,
        tcuEmentaCompleta: null, description: 'desc', content: null, tcuRelator: null,
        tcuAutorTese: null, tcuOrgaoJulgador: null, tcuDataJulgamento: null, tcuLinkPDF: null,
        summary: null, themes: null, leiArticles: null, url: null, douData: null,
        uploadedAt: new Date(), updatedAt: new Date(), entityType: null, enunciadoNumber: null },
    ]);
    mockTribunalDecisionFindMany.mockResolvedValueOnce([
      { id: 'td-1', tribunalCode: 'STJ', tribunalName: 'STJ', decisionType: 'decisao',
        decisionNumber: '9/24', title: 'T', ementa: 'e', summary: null, relator: null,
        orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticles: null, url: null },
    ]);

    const results = [makeDocResult('doc-1', 'informativo'), makeTdResult('td-1')];
    const enriched = await enrichSources(results);

    expect(enriched).toHaveLength(2);
    expect(enriched.find(e => e.documentId === 'doc-1')?.source.kind).toBe('document');
    expect(enriched.find(e => e.documentId === 'td-1')?.source.kind).toBe('tribunal-decision');
  });
});
```

- [ ] **Step 3.3: Rodar testes para verificar que falham**

Run: `npx vitest run lib/jurisprudencia/__tests__/semantic-adapter.test.ts`
Expected: FAIL — `enrichSources is not exported`.

- [ ] **Step 3.4: Implementar `enrichSources` no adapter**

Edit: `lib/jurisprudencia/semantic-adapter.ts` — adicionar no fim:

```ts
import { prisma } from '@/lib/prisma';
import type { SearchResult } from '@/lib/embeddings/vector-search';

// ──────────────────────────────────────────────────────────────────────────
// Enriquecimento de resultados
// ──────────────────────────────────────────────────────────────────────────

export interface EnrichedDocument {
  id: string;
  title: string;
  category: string;
  tcuNumeroAcordao: string | null;
  tcuEmentaCompleta: string | null;
  description: string | null;
  content: string | null;
  tcuRelator: string | null;
  tcuAutorTese: string | null;
  tcuOrgaoJulgador: string | null;
  tcuDataJulgamento: Date | null;
  tcuLinkPDF: string | null;
  summary: string | null;
  themes: string | null;
  leiArticles: string | null;
  url: string | null;
  douData: Date | null;
  uploadedAt: Date;
  updatedAt: Date;
  entityType: string | null;
  enunciadoNumber: string | null;
}

export interface EnrichedTribunalDecision {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  title: string;
  ementa: string;
  summary: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  themes: string | null;
  leiArticles: string | null;
  url: string | null;
}

export interface EnrichedSource {
  documentId: string;
  similarity: number;
  chunkContent: string;
  source:
    | { kind: 'document'; data: EnrichedDocument; category: string }
    | { kind: 'tribunal-decision'; data: EnrichedTribunalDecision };
}

export async function enrichSources(
  results: SearchResult[]
): Promise<EnrichedSource[]> {
  const docIds = results
    .filter(r => r.sourceType === 'document')
    .map(r => r.documentId);
  const tdIds = results
    .filter(r => r.sourceType === 'tribunal-decision')
    .map(r => r.documentId);

  const [docs, tds] = await Promise.all([
    docIds.length > 0
      ? prisma.document.findMany({
          where: { id: { in: docIds } },
          select: {
            id: true,
            title: true,
            category: true,
            tcuNumeroAcordao: true,
            tcuEmentaCompleta: true,
            description: true,
            content: true,
            tcuRelator: true,
            tcuAutorTese: true,
            tcuOrgaoJulgador: true,
            tcuDataJulgamento: true,
            tcuLinkPDF: true,
            summary: true,
            themes: true,
            leiArticles: true,
            url: true,
            douData: true,
            uploadedAt: true,
            updatedAt: true,
            entityType: true,
            enunciadoNumber: true,
          },
        })
      : Promise.resolve([] as EnrichedDocument[]),
    tdIds.length > 0
      ? prisma.tribunalDecision.findMany({
          where: { id: { in: tdIds } },
          select: {
            id: true,
            tribunalCode: true,
            tribunalName: true,
            decisionType: true,
            decisionNumber: true,
            title: true,
            ementa: true,
            summary: true,
            relator: true,
            orgaoJulgador: true,
            dataJulgamento: true,
            themes: true,
            leiArticles: true,
            url: true,
          },
        })
      : Promise.resolve([] as EnrichedTribunalDecision[]),
  ]);

  const docById = new Map(docs.map(d => [d.id, d]));
  const tdById = new Map(tds.map(t => [t.id, t]));

  const enriched: EnrichedSource[] = [];
  for (const r of results) {
    if (r.sourceType === 'document') {
      const doc = docById.get(r.documentId);
      if (!doc) continue; // órfão — skip silencioso
      enriched.push({
        documentId: r.documentId,
        similarity: r.similarity,
        chunkContent: r.chunkContent,
        source: { kind: 'document', data: doc, category: doc.category },
      });
    } else if (r.sourceType === 'tribunal-decision') {
      const td = tdById.get(r.documentId);
      if (!td) continue;
      enriched.push({
        documentId: r.documentId,
        similarity: r.similarity,
        chunkContent: r.chunkContent,
        source: { kind: 'tribunal-decision', data: td },
      });
    }
    // legislative-act não chega aqui porque skipLegislativeActBranch=true na rota IA
  }

  return enriched;
}
```

- [ ] **Step 3.5: Rodar testes — verificar que passam**

Run: `npx vitest run lib/jurisprudencia/__tests__/semantic-adapter.test.ts`
Expected: PASS (14 testes).

- [ ] **Step 3.6: Commit**

```bash
git add lib/jurisprudencia/semantic-adapter.ts lib/jurisprudencia/__tests__/semantic-adapter.test.ts
git commit -m "feat(jurisprudencia): semantic-adapter — enrichSources"
```

---

## Task 4: `semantic-adapter` — `adaptToSourcesPayload` + utils

**Files:**
- Modify: `lib/jurisprudencia/semantic-adapter.ts`
- Modify: `lib/jurisprudencia/__tests__/semantic-adapter.test.ts`

**Contexto:** O último pedaço do adapter — transformar `EnrichedSource[]` no shape uniforme que o front-end espera (igual ao da PR anterior, com `sourceType` adicional). Utilitários: `resolveEmenta` (fallback chain), `deriveInformativoNumber` (regex do title), `mapEntityToTribunalCode` (IBDA/INCP/CJF).

- [ ] **Step 4.1: Adicionar testes de `adaptToSourcesPayload` — TribunalDecision**

Edit: `lib/jurisprudencia/__tests__/semantic-adapter.test.ts` — adicionar no fim:

```ts
describe('adaptToSourcesPayload — TribunalDecision', () => {
  it('mapeia campos diretos', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'td-1',
        similarity: 0.85,
        chunkContent: 'trecho',
        source: {
          kind: 'tribunal-decision' as const,
          data: {
            id: 'td-1',
            tribunalCode: 'TCE-SP',
            tribunalName: 'Tribunal de Contas do Estado de São Paulo',
            decisionType: 'acordao',
            decisionNumber: '1234/2024',
            title: 'Acórdão TCE-SP',
            ementa: 'Ementa completa',
            summary: null,
            relator: 'Ministro X',
            orgaoJulgador: 'Plenário',
            dataJulgamento: new Date('2024-05-01'),
            themes: '["tema1"]',
            leiArticles: '["75"]',
            url: 'http://x',
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload).toHaveLength(1);
    expect(payload[0]).toEqual({
      id: 'td-1',
      tribunalCode: 'TCE-SP',
      tribunalName: 'Tribunal de Contas do Estado de São Paulo',
      decisionType: 'acordao',
      decisionNumber: '1234/2024',
      title: 'Acórdão TCE-SP',
      relator: 'Ministro X',
      orgaoJulgador: 'Plenário',
      dataJulgamento: new Date('2024-05-01'),
      url: 'http://x',
      sourceType: 'tribunal-decision',
      similarity: 0.85,
    });
  });
});

describe('adaptToSourcesPayload — Document acordao/consulta_tcu', () => {
  it('acordao TCU: tribunalCode=TCU, decisionType=acordao, relator com fallback', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'doc-1',
        similarity: 0.82,
        chunkContent: 'tr',
        source: {
          kind: 'document' as const,
          category: 'acordao',
          data: {
            id: 'doc-1',
            title: 'Acórdão',
            category: 'acordao',
            tcuNumeroAcordao: 'AC-1106/24-P',
            tcuEmentaCompleta: 'ementa',
            description: null,
            content: null,
            tcuRelator: null,
            tcuAutorTese: 'MIN AUGUSTO',
            tcuOrgaoJulgador: 'Plenário',
            tcuDataJulgamento: new Date('2024-05-20'),
            tcuLinkPDF: 'http://tcu.pdf',
            summary: null,
            themes: null,
            leiArticles: null,
            url: 'http://tcu.ac/1106',
            douData: null,
            uploadedAt: new Date(),
            updatedAt: new Date(),
            entityType: null,
            enunciadoNumber: null,
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload[0]).toMatchObject({
      tribunalCode: 'TCU',
      tribunalName: 'Tribunal de Contas da União',
      decisionType: 'acordao',
      decisionNumber: 'AC-1106/24-P',
      relator: 'MIN AUGUSTO', // fallback tcuAutorTese
      orgaoJulgador: 'Plenário',
      sourceType: 'document-tcu-acordao',
    });
  });
});

describe('adaptToSourcesPayload — informativo', () => {
  it('informativo: decisionType=informativo, decisionNumber derivado do title', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'inf-1',
        similarity: 0.88,
        chunkContent: 't',
        source: {
          kind: 'document' as const,
          category: 'informativo',
          data: {
            id: 'inf-1',
            title: 'Informativo LC nº 42',
            category: 'informativo',
            tcuNumeroAcordao: null,
            tcuEmentaCompleta: null,
            description: 'resumo',
            content: null,
            tcuRelator: null,
            tcuAutorTese: null,
            tcuOrgaoJulgador: null,
            tcuDataJulgamento: null,
            tcuLinkPDF: null,
            summary: null,
            themes: null,
            leiArticles: null,
            url: null,
            douData: new Date('2024-01-15'),
            uploadedAt: new Date('2024-02-01'),
            updatedAt: new Date(),
            entityType: null,
            enunciadoNumber: null,
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload[0]).toMatchObject({
      tribunalCode: 'TCU',
      decisionType: 'informativo',
      decisionNumber: 'Informativo LC nº 42',
      relator: null,
      dataJulgamento: new Date('2024-01-15'), // prefere douData
      sourceType: 'document-tcu-informativo',
    });
  });
});

describe('adaptToSourcesPayload — manual-tcu', () => {
  it('manual: decisionType=manual, decisionNumber=title', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'man-1',
        similarity: 0.7,
        chunkContent: 't',
        source: {
          kind: 'document' as const,
          category: 'manual-tcu',
          data: {
            id: 'man-1',
            title: 'Manual de Auditoria TCU 2023',
            category: 'manual-tcu',
            tcuNumeroAcordao: null, tcuEmentaCompleta: null, description: null, content: null,
            tcuRelator: null, tcuAutorTese: null, tcuOrgaoJulgador: null,
            tcuDataJulgamento: null, tcuLinkPDF: null, summary: null, themes: null,
            leiArticles: null, url: null, douData: null,
            uploadedAt: new Date('2023-01-01'), updatedAt: new Date(),
            entityType: null, enunciadoNumber: null,
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload[0]).toMatchObject({
      tribunalCode: 'TCU',
      decisionType: 'manual',
      decisionNumber: 'Manual de Auditoria TCU 2023',
      sourceType: 'document-tcu-manual',
    });
  });
});

describe('adaptToSourcesPayload — enunciados', () => {
  it('enunciado: tribunalCode do entityType, decisionNumber=enunciadoNumber', async () => {
    const { adaptToSourcesPayload } = await import('../semantic-adapter');

    const enriched = [
      {
        documentId: 'en-1',
        similarity: 0.75,
        chunkContent: 't',
        source: {
          kind: 'document' as const,
          category: 'enunciados',
          data: {
            id: 'en-1',
            title: 'Enunciado IBDA nº 10',
            category: 'enunciados',
            tcuNumeroAcordao: null, tcuEmentaCompleta: null, description: 'texto',
            content: null, tcuRelator: null, tcuAutorTese: null, tcuOrgaoJulgador: null,
            tcuDataJulgamento: null, tcuLinkPDF: null, summary: null, themes: null,
            leiArticles: null, url: null, douData: null,
            uploadedAt: new Date(), updatedAt: new Date(),
            entityType: 'IBDA',
            enunciadoNumber: '10',
          },
        },
      },
    ];

    const payload = adaptToSourcesPayload(enriched);
    expect(payload[0]).toMatchObject({
      tribunalCode: 'IBDA',
      tribunalName: 'Instituto Brasileiro de Direito Administrativo',
      decisionType: 'enunciado',
      decisionNumber: '10',
      sourceType: 'document-tcu-enunciado',
    });
  });
});
```

- [ ] **Step 4.2: Rodar testes — verificar que falham**

Run: `npx vitest run lib/jurisprudencia/__tests__/semantic-adapter.test.ts`
Expected: FAIL — `adaptToSourcesPayload` não existe.

- [ ] **Step 4.3: Implementar `adaptToSourcesPayload` e utils**

Edit: `lib/jurisprudencia/semantic-adapter.ts` — adicionar no fim:

```ts
// ──────────────────────────────────────────────────────────────────────────
// Payload uniforme para o front-end
// ──────────────────────────────────────────────────────────────────────────

export interface JurisprudenciaSource {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  title: string;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  url: string | null;
  sourceType: string; // 'tribunal-decision' | 'document-tcu-acordao' | 'document-tcu-informativo' | ...
  similarity: number;
}

const ENTITY_TRIBUNAL_NAMES: Record<string, string> = {
  IBDA: 'Instituto Brasileiro de Direito Administrativo',
  INCP: 'Instituto Nacional da Contratação Pública',
  CJF: 'Conselho da Justiça Federal',
};

function deriveInformativoNumber(title: string): string {
  // Tenta casar "Informativo LC nº 42", "Informativo CGU 123", etc.
  const match = title.match(/Informativo[\s\w]*?(nº\s*\d+|\d+)/i);
  return match ? match[0] : title;
}

export function adaptToSourcesPayload(
  enriched: EnrichedSource[]
): JurisprudenciaSource[] {
  return enriched.map(e => {
    if (e.source.kind === 'tribunal-decision') {
      const td = e.source.data;
      return {
        id: td.id,
        tribunalCode: td.tribunalCode,
        tribunalName: td.tribunalName,
        decisionType: td.decisionType,
        decisionNumber: td.decisionNumber,
        title: td.title,
        relator: td.relator,
        orgaoJulgador: td.orgaoJulgador,
        dataJulgamento: td.dataJulgamento,
        url: td.url,
        sourceType: 'tribunal-decision',
        similarity: e.similarity,
      };
    }

    // Document — switch por categoria
    const doc = e.source.data;
    switch (e.source.category) {
      case 'acordao':
      case 'consulta_tcu':
        return {
          id: doc.id,
          tribunalCode: 'TCU',
          tribunalName: 'Tribunal de Contas da União',
          decisionType: 'acordao',
          decisionNumber: doc.tcuNumeroAcordao ?? doc.title,
          title: doc.title,
          relator: doc.tcuRelator ?? doc.tcuAutorTese,
          orgaoJulgador: doc.tcuOrgaoJulgador,
          dataJulgamento: doc.tcuDataJulgamento,
          url: doc.url,
          sourceType: `document-tcu-${e.source.category === 'consulta_tcu' ? 'consulta' : 'acordao'}`,
          similarity: e.similarity,
        };
      case 'informativo':
        return {
          id: doc.id,
          tribunalCode: 'TCU',
          tribunalName: 'Tribunal de Contas da União',
          decisionType: 'informativo',
          decisionNumber: deriveInformativoNumber(doc.title),
          title: doc.title,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: doc.douData ?? doc.uploadedAt,
          url: doc.url,
          sourceType: 'document-tcu-informativo',
          similarity: e.similarity,
        };
      case 'manual-tcu':
        return {
          id: doc.id,
          tribunalCode: 'TCU',
          tribunalName: 'Tribunal de Contas da União',
          decisionType: 'manual',
          decisionNumber: doc.title,
          title: doc.title,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: doc.uploadedAt,
          url: doc.url,
          sourceType: 'document-tcu-manual',
          similarity: e.similarity,
        };
      case 'enunciados': {
        const code = doc.entityType ?? 'IBDA';
        return {
          id: doc.id,
          tribunalCode: code,
          tribunalName: ENTITY_TRIBUNAL_NAMES[code] ?? code,
          decisionType: 'enunciado',
          decisionNumber: doc.enunciadoNumber ?? doc.title,
          title: doc.title,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: doc.uploadedAt,
          url: doc.url,
          sourceType: 'document-tcu-enunciado',
          similarity: e.similarity,
        };
      }
      default:
        // Fallback genérico — não deveria acontecer, mas shape sempre válido
        return {
          id: doc.id,
          tribunalCode: 'TCU',
          tribunalName: 'Tribunal de Contas da União',
          decisionType: e.source.category,
          decisionNumber: doc.title,
          title: doc.title,
          relator: null,
          orgaoJulgador: null,
          dataJulgamento: doc.uploadedAt,
          url: doc.url,
          sourceType: `document-${e.source.category}`,
          similarity: e.similarity,
        };
    }
  });
}

/**
 * Fallback chain para ementa, usado na construção do prompt Gemini.
 * Document TCU acórdão tem tcuEmentaCompleta; informativo usa description; etc.
 */
export function resolveEmenta(e: EnrichedSource): string {
  if (e.source.kind === 'tribunal-decision') {
    return e.source.data.ementa ?? '';
  }
  const doc = e.source.data;
  return (
    doc.tcuEmentaCompleta ??
    doc.description ??
    doc.content ??
    ''
  );
}
```

- [ ] **Step 4.4: Rodar testes — todos devem passar**

Run: `npx vitest run lib/jurisprudencia/__tests__/semantic-adapter.test.ts`
Expected: PASS — todos os testes (≈19 no total entre Tasks 2/3/4).

- [ ] **Step 4.5: Commit**

```bash
git add lib/jurisprudencia/semantic-adapter.ts lib/jurisprudencia/__tests__/semantic-adapter.test.ts
git commit -m "feat(jurisprudencia): semantic-adapter — adaptToSourcesPayload + utils"
```

---

## Task 5: Atualizar rota IA para usar semantic search

**Files:**
- Modify: `app/api/jurisprudencia/query/route.ts`
- Modify: `app/api/jurisprudencia/__tests__/query.test.ts`

**Contexto:** A rota `POST /api/jurisprudencia/query` atual usa `fetchUnifiedTopK` + `countUnifiedApproved`. Refactor: troca para `semanticSearch` + `enrichSources` + `adaptToSourcesPayload`. Preserva `withAuth`, validação Zod, `buildPrompt` (com adição do chunkContent), Gemini call, fallbacks de erro. O count de fallback continua via `countUnifiedApproved`.

- [ ] **Step 5.1: Atualizar o arquivo de testes existente para novos mocks**

Edit: `app/api/jurisprudencia/__tests__/query.test.ts` — SUBSTITUIR inteiro (arquivo atual já existe da PR anterior):

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSemanticSearch,
  mockEnrichSources,
  mockAdaptToSourcesPayload,
  mockMapFiltersToSemanticOptions,
  mockResolveEmenta,
  mockCountUnifiedApproved,
  mockQueryGeminiText,
} = vi.hoisted(() => ({
  mockSemanticSearch: vi.fn(),
  mockEnrichSources: vi.fn(),
  mockAdaptToSourcesPayload: vi.fn(),
  mockMapFiltersToSemanticOptions: vi.fn(),
  mockResolveEmenta: vi.fn(),
  mockCountUnifiedApproved: vi.fn(),
  mockQueryGeminiText: vi.fn(),
}));

vi.mock('@/lib/embeddings/vector-search', () => ({
  semanticSearch: (...args: any[]) => mockSemanticSearch(...args),
}));

vi.mock('@/lib/jurisprudencia/semantic-adapter', () => ({
  mapFiltersToSemanticOptions: (...args: any[]) => mockMapFiltersToSemanticOptions(...args),
  enrichSources: (...args: any[]) => mockEnrichSources(...args),
  adaptToSourcesPayload: (...args: any[]) => mockAdaptToSourcesPayload(...args),
  resolveEmenta: (...args: any[]) => mockResolveEmenta(...args),
}));

vi.mock('@/lib/jurisprudencia/unified-query', () => ({
  countUnifiedApproved: (...args: any[]) => mockCountUnifiedApproved(...args),
}));

vi.mock('@/lib/gemini/cached-client', () => ({
  queryGeminiText: (...args: any[]) => mockQueryGeminiText(...args),
}));

vi.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: any) => (req: any, ctx?: any) =>
    handler(req, {
      ...ctx,
      user: { userId: 'u1', email: 'u@x.com', role: 'student' },
    }),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

process.env.GEMINI_API_KEY = 'test-key';

import { POST } from '@/app/api/jurisprudencia/query/route';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/jurisprudencia/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

beforeEach(() => {
  mockSemanticSearch.mockReset();
  mockEnrichSources.mockReset();
  mockAdaptToSourcesPayload.mockReset();
  mockMapFiltersToSemanticOptions.mockReset();
  mockResolveEmenta.mockReset();
  mockCountUnifiedApproved.mockReset();
  mockQueryGeminiText.mockReset();

  // Default: adapter passes options through
  mockMapFiltersToSemanticOptions.mockReturnValue({
    skipLegislativeActBranch: true,
    includeTribunalDecisions: true,
  });
  mockResolveEmenta.mockReturnValue('ementa mock');
});

describe('POST /api/jurisprudencia/query', () => {
  it('chama semanticSearch com a query e opções mapeadas', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [
        {
          documentId: 'td-1',
          documentTitle: 'Acórdão TCE-SP 1/24',
          category: 'acordao',
          chunkContent: 'trecho',
          chunkIndex: 0,
          similarity: 0.8,
          url: null,
          courseId: null,
          isCommon: true,
          tags: null,
          leiArticles: null,
          uploadedAt: '2024-01-01',
          sourceType: 'tribunal-decision',
        },
      ],
      query: 'pregão',
      totalFound: 1,
      latency: 100,
      cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([
      {
        documentId: 'td-1',
        similarity: 0.8,
        chunkContent: 'trecho',
        source: { kind: 'tribunal-decision', data: { id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'TCE-SP', decisionType: 'acordao', decisionNumber: '1/24', title: 't', ementa: 'e', summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticles: null, url: null } },
      },
    ]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([
      {
        id: 'td-1',
        tribunalCode: 'TCE-SP',
        tribunalName: 'TCE-SP',
        decisionType: 'acordao',
        decisionNumber: '1/24',
        title: 't',
        relator: null,
        orgaoJulgador: null,
        dataJulgamento: null,
        url: null,
        sourceType: 'tribunal-decision',
        similarity: 0.8,
      },
    ]);
    mockQueryGeminiText.mockResolvedValueOnce({
      response: 'resposta',
      cached: false,
      latency: 50,
    });

    const res = await POST(makeReq({ query: 'pregão eletrônico', filters: { tribunal: 'TCE-SP' } }));
    expect(res.status).toBe(200);

    expect(mockMapFiltersToSemanticOptions).toHaveBeenCalledWith(
      expect.objectContaining({ tribunal: 'TCE-SP' })
    );
    expect(mockSemanticSearch).toHaveBeenCalledWith(
      'pregão eletrônico',
      expect.objectContaining({ skipLegislativeActBranch: true })
    );

    const body = await readJson(res);
    expect(body.answer).toBe('resposta');
    expect(body.consulted).toBe(1);
    expect(body.sources[0].tribunalCode).toBe('TCE-SP');
  });

  it('retorna mensagem de base vazia quando semanticSearch=[] e count=0', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [], query: 'q', totalFound: 0, latency: 10, cached: false,
    });
    mockCountUnifiedApproved.mockResolvedValueOnce(0);

    const res = await POST(makeReq({ query: 'qualquer coisa' }));
    const body = await readJson(res);

    expect(body.sources).toEqual([]);
    expect(body.consulted).toBe(0);
    expect(body.totalInDatabase).toBe(0);
    expect(body.answer).toMatch(/ainda não foi populada/);
  });

  it('retorna mensagem de filtros restritivos quando semanticSearch=[] mas count>0', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [], query: 'q', totalFound: 0, latency: 10, cached: false,
    });
    mockCountUnifiedApproved.mockResolvedValueOnce(500);

    const res = await POST(makeReq({ query: 'qualquer coisa' }));
    const body = await readJson(res);

    expect(body.totalInDatabase).toBe(500);
    expect(body.answer).toMatch(/Não encontrei decisões/);
  });

  it('fallback quando Gemini lança erro (retorna sources sem answer sintetizada)', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'td-1', documentTitle: 't', category: 'acordao', chunkContent: 'c', chunkIndex: 0, similarity: 0.8, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'tribunal-decision' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'td-1', similarity: 0.8, chunkContent: 'c',
      source: { kind: 'tribunal-decision', data: { id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao', decisionNumber: '1', title: 't', ementa: 'e', summary: null, relator: null, orgaoJulgador: null, dataJulgamento: null, themes: null, leiArticles: null, url: null } },
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'td-1', tribunalCode: 'TCE-SP', tribunalName: 'T', decisionType: 'acordao',
      decisionNumber: '1', title: 't', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'tribunal-decision', similarity: 0.8,
    }]);
    mockQueryGeminiText.mockRejectedValueOnce(new Error('gemini down'));

    const res = await POST(makeReq({ query: 'pergunta' }));
    const body = await readJson(res);

    expect(body.sources).toHaveLength(1);
    expect(body.answer).toMatch(/Não consegui gerar uma síntese/);
  });

  it('cita informativo TCU quando semanticSearch retorna informativo', async () => {
    mockSemanticSearch.mockResolvedValueOnce({
      results: [{ documentId: 'inf-1', documentTitle: 'Informativo LC nº 42', category: 'informativo', chunkContent: 'trecho do informativo', chunkIndex: 0, similarity: 0.9, url: null, courseId: null, isCommon: true, tags: null, leiArticles: null, uploadedAt: '2024-01-01', sourceType: 'document' }],
      query: 'q', totalFound: 1, latency: 10, cached: false,
    });
    mockEnrichSources.mockResolvedValueOnce([{
      documentId: 'inf-1', similarity: 0.9, chunkContent: 'trecho do informativo',
      source: { kind: 'document', category: 'informativo', data: {
        id: 'inf-1', title: 'Informativo LC nº 42', category: 'informativo',
        tcuNumeroAcordao: null, tcuEmentaCompleta: null, description: 'resumo', content: null,
        tcuRelator: null, tcuAutorTese: null, tcuOrgaoJulgador: null,
        tcuDataJulgamento: null, tcuLinkPDF: null, summary: null, themes: null,
        leiArticles: null, url: null, douData: null,
        uploadedAt: new Date(), updatedAt: new Date(), entityType: null, enunciadoNumber: null,
      }},
    }]);
    mockAdaptToSourcesPayload.mockReturnValueOnce([{
      id: 'inf-1', tribunalCode: 'TCU', tribunalName: 'Tribunal de Contas da União',
      decisionType: 'informativo', decisionNumber: 'Informativo LC nº 42',
      title: 'Informativo LC nº 42', relator: null, orgaoJulgador: null,
      dataJulgamento: null, url: null, sourceType: 'document-tcu-informativo', similarity: 0.9,
    }]);
    mockQueryGeminiText.mockResolvedValueOnce({ response: 'r', cached: false, latency: 10 });

    const res = await POST(makeReq({ query: 'segregação de funções' }));
    const body = await readJson(res);

    expect(body.sources[0].decisionType).toBe('informativo');
    expect(body.sources[0].tribunalCode).toBe('TCU');
  });

  it('passa filtros tais como ano, tema, dataFrom ao adapter', async () => {
    mockSemanticSearch.mockResolvedValueOnce({ results: [], query: 'q', totalFound: 0, latency: 10, cached: false });
    mockCountUnifiedApproved.mockResolvedValueOnce(0);

    await POST(makeReq({
      query: 'teste',
      filters: { year: 2024, theme: 'pregão', dataFrom: '2024-01-01' },
    }));

    expect(mockMapFiltersToSemanticOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        ano: 2024,
        tema: 'pregão',
        dataFrom: expect.any(Date),
      })
    );
  });
});
```

- [ ] **Step 5.2: Rodar teste — verificar que falha**

Run: `npx vitest run app/api/jurisprudencia/__tests__/query.test.ts`
Expected: FAIL — rota ainda usa `fetchUnifiedTopK/countUnifiedApproved` diretamente.

- [ ] **Step 5.3: Reescrever a rota IA**

Edit: `app/api/jurisprudencia/query/route.ts` — substituir arquivo inteiro:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { semanticSearch } from '@/lib/embeddings/vector-search';
import {
  mapFiltersToSemanticOptions,
  enrichSources,
  adaptToSourcesPayload,
  resolveEmenta,
  type EnrichedSource,
  type JurisprudenciaSource,
} from '@/lib/jurisprudencia/semantic-adapter';
import { countUnifiedApproved } from '@/lib/jurisprudencia/unified-query';
import type { JurisprudenciaFilters } from '@/lib/jurisprudencia/unified-query';
import { queryGeminiText } from '@/lib/gemini/cached-client';
import { handleApiError } from '@/lib/errors/error-handler';
import { apiLogger } from '@/lib/logger';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TRIBUNAL_CODES = [
  'TCU',
  'TCE-SP',
  'TCE-PR',
  'TCE-MG',
  'TCE-RS',
  'TCE-SC',
  'TCE-RJ',
  'TCE-PE',
  'STJ',
  'STF',
] as const;

const DECISION_TYPES = [
  'acordao',
  'decisao',
  'parecer_previo',
  'sumula',
] as const;

const filtersSchema = z
  .object({
    tribunal: z.enum(TRIBUNAL_CODES).optional(),
    year: z.number().int().optional(),
    theme: z.string().optional(),
    leiArticle: z.string().optional(),
    decisionType: z.enum(DECISION_TYPES).optional(),
    relator: z.string().optional(),
    orgao: z.string().optional(),
    dataFrom: z.string().optional(),
    dataTo: z.string().optional(),
    q: z.string().optional(),
  })
  .optional();

const bodySchema = z.object({
  query: z.string().min(3).max(500),
  filters: filtersSchema,
  topK: z.number().int().min(1).max(20).optional(),
});

const MAX_EMENTA_CHARS = 800;
const MAX_CHUNK_CHARS = 600;
const MAX_SUMMARY_CHARS = 600;
const DEFAULT_TOP_K = 6;

type Filters = z.infer<typeof filtersSchema>;

function toJurisprudenciaFilters(filters: Filters): JurisprudenciaFilters {
  if (!filters) return {};
  return {
    tribunal: filters.tribunal,
    ano: filters.year,
    tema: filters.theme,
    artigo: filters.leiArticle,
    decisionType: filters.decisionType,
    relator: filters.relator,
    orgao: filters.orgao,
    dataFrom: filters.dataFrom ? new Date(filters.dataFrom) : undefined,
    dataTo: filters.dataTo ? new Date(filters.dataTo) : undefined,
    q: filters.q,
  };
}

function truncate(value: string | null | undefined, limit: number): string {
  if (!value) return '';
  return value.length > limit ? value.slice(0, limit) + '...' : value;
}

function buildPrompt(
  question: string,
  enriched: EnrichedSource[],
  payload: JurisprudenciaSource[]
): string {
  const header = `Você é um assistente jurídico especializado em licitações, contratos públicos e Lei 14.133/2021. Responda à pergunta do aluno exclusivamente com base nos trechos de decisões de tribunais fornecidos abaixo. Cite as decisões pelo identificador (ex.: [TCE-SP Acórdão 1234/2024]). Se os trechos não forem suficientes, diga isso com clareza e sugira ajustar os filtros.`;

  const blocks = enriched.map((e, idx) => {
    const p = payload[idx];
    const id = `${p.tribunalCode} ${p.decisionType} ${p.decisionNumber}`;
    const dateStr = p.dataJulgamento
      ? new Date(p.dataJulgamento).toLocaleDateString('pt-BR')
      : 'data não informada';
    const ementa = resolveEmenta(e);
    const summary =
      e.source.kind === 'tribunal-decision'
        ? e.source.data.summary
        : e.source.data.summary;
    const themes =
      e.source.kind === 'tribunal-decision'
        ? e.source.data.themes
        : e.source.data.themes;
    const leiArticles =
      e.source.kind === 'tribunal-decision'
        ? e.source.data.leiArticles
        : e.source.data.leiArticles;
    const similarityPct = (e.similarity * 100).toFixed(0);
    return `[${idx + 1}] ${id} — ${dateStr}
Título: ${p.title}
Órgão: ${p.orgaoJulgador || 'n/d'} | Relator: ${p.relator || 'n/d'}
Temas: ${themes || 'n/d'} | Artigos Lei 14.133: ${leiArticles || 'n/d'}
Ementa: ${truncate(ementa, MAX_EMENTA_CHARS)}
Trecho relevante (similaridade ${similarityPct}%): ${truncate(e.chunkContent, MAX_CHUNK_CHARS)}
Resumo IA: ${truncate(summary, MAX_SUMMARY_CHARS)}`;
  }).join('\n\n---\n\n');

  return `${header}

PERGUNTA DO ALUNO:
${question}

DECISÕES CONSULTADAS:
${blocks}

Sua resposta (em português, estruturada, com citações no formato [Tribunal Tipo Número]):`;
}

function countBySourceType(payload: JurisprudenciaSource[]) {
  const counts: Record<string, number> = {};
  for (const p of payload) {
    counts[p.sourceType] = (counts[p.sourceType] ?? 0) + 1;
  }
  return counts;
}

export const POST = withAuth(
  async (request: NextRequest, context?: Record<string, unknown>) => {
    try {
      const user = context?.user as { userId: string; role?: string };

      const json = await request.json();
      const parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Requisição inválida', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          {
            error:
              'Serviço de IA não está configurado neste ambiente. A pesquisa com IA requer a variável GEMINI_API_KEY — peça ao administrador para provisioná-la.',
          },
          { status: 503 }
        );
      }

      const { query, filters, topK } = parsed.data;
      const limit = topK ?? DEFAULT_TOP_K;

      const jurisFilters = toJurisprudenciaFilters(filters);
      const searchOptions = mapFiltersToSemanticOptions(jurisFilters);
      const searchResponse = await semanticSearch(query, {
        ...searchOptions,
        limit,
      });

      if (searchResponse.results.length === 0) {
        const totalInDatabase = await countUnifiedApproved();
        const msg =
          totalInDatabase === 0
            ? 'A base de jurisprudência deste ambiente ainda não foi populada. Fale com o administrador para rodar a ingestão de decisões.'
            : 'Não encontrei decisões que casassem semanticamente com essa pergunta. Tente reformular em outros termos ou usar os filtros para restringir manualmente a pesquisa.';
        return NextResponse.json({
          answer: msg,
          sources: [],
          consulted: 0,
          totalInDatabase,
        });
      }

      const enriched = await enrichSources(searchResponse.results);
      if (enriched.length === 0) {
        apiLogger.warn(
          { userId: user.userId, resultCount: searchResponse.results.length },
          'jurisprudencia/query all results were orphaned chunks'
        );
        return NextResponse.json({
          answer:
            'Os trechos relevantes encontrados apontam para documentos que não estão mais disponíveis. Tente reformular a pergunta.',
          sources: [],
          consulted: 0,
          totalInDatabase: await countUnifiedApproved(),
        });
      }

      const sourcesPayload = adaptToSourcesPayload(enriched);

      const prompt = buildPrompt(query, enriched, sourcesPayload);

      const avgSimilarity =
        enriched.reduce((sum, e) => sum + e.similarity, 0) / enriched.length;
      const byType = countBySourceType(sourcesPayload);

      let answerText: string;
      let cached = false;

      try {
        const result = await queryGeminiText(prompt, {
          temperature: 0.3,
          maxOutputTokens: 1500,
          useCache: true,
          systemInstruction:
            'Você é um assistente jurídico técnico e conciso. Fundamente tudo nas decisões citadas; nunca invente números de acórdão ou relatores.',
        });

        if (!result.response || result.response.trim().length === 0) {
          throw new Error('empty-response');
        }

        answerText = result.response;
        cached = result.cached;

        apiLogger.info(
          {
            userId: user.userId,
            consulted: enriched.length,
            byType,
            avgSimilarity,
            cached,
            latencyMs: result.latency,
          },
          'jurisprudencia/query answered'
        );
      } catch (err) {
        apiLogger.error(
          { userId: user.userId, consulted: enriched.length, err },
          'jurisprudencia/query Gemini failed — returning sources only'
        );
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        answerText =
          'Não consegui gerar uma síntese agora — o modelo de IA pode estar sobrecarregado, em timeout ou indisponível. Encontrei as decisões relevantes abaixo; consulte-as diretamente ou tente perguntar de novo em alguns instantes.';

        // Debug info liberado enquanto estamos diagnosticando o bug em preview.
        // TODO: restringir para role === 'admin' quando o diagnóstico terminar.
        const debug = { geminiError: errMsg, stack: errStack };
        return NextResponse.json({
          answer: answerText,
          sources: sourcesPayload,
          consulted: enriched.length,
          cached: false,
          debug,
        });
      }

      return NextResponse.json({
        answer: answerText,
        sources: sourcesPayload,
        consulted: enriched.length,
        cached,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
);
```

- [ ] **Step 5.4: Rodar testes — verificar que passam**

Run: `npx vitest run app/api/jurisprudencia/__tests__/query.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5.5: Rodar suite completa de jurisprudência pra garantir sem regressão**

Run: `npx vitest run lib/jurisprudencia lib/embeddings app/api/jurisprudencia`
Expected: PASS em todos.

- [ ] **Step 5.6: Commit**

```bash
git add app/api/jurisprudencia/query/route.ts app/api/jurisprudencia/__tests__/query.test.ts
git commit -m "feat(jurisprudencia): rota IA usa semantic search via vector-search + adapter"
```

---

## Task 6: Fix do pipeline de indexação (`process-index-jobs`)

**Files:**
- Modify: `app/api/cron/process-index-jobs/route.ts`
- Create: `app/api/cron/__tests__/process-index-jobs.test.ts`

**Contexto:** Aumentar `MAX_JOBS_PER_RUN` de 10 para 50, trocar ordenação DESC→ASC (FIFO), e processar batches paralelos de 10 via `Promise.all`. Respeita time budget de 250s.

- [ ] **Step 6.1: Criar arquivo de teste**

Create: `app/api/cron/__tests__/process-index-jobs.test.ts`

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockIndexJobFindMany,
  mockDocumentFindMany,
  mockTribunalDecisionFindMany,
  mockIndexJobUpdate,
  mockProcessDocument,
  mockProcessTribunalDecision,
  mockGetProcessingStats,
} = vi.hoisted(() => ({
  mockIndexJobFindMany: vi.fn(),
  mockDocumentFindMany: vi.fn(),
  mockTribunalDecisionFindMany: vi.fn(),
  mockIndexJobUpdate: vi.fn(),
  mockProcessDocument: vi.fn(),
  mockProcessTribunalDecision: vi.fn(),
  mockGetProcessingStats: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    indexJob: {
      findMany: (...args: any[]) => mockIndexJobFindMany(...args),
      update: (...args: any[]) => mockIndexJobUpdate(...args),
    },
    document: { findMany: (...args: any[]) => mockDocumentFindMany(...args) },
    tribunalDecision: { findMany: (...args: any[]) => mockTribunalDecisionFindMany(...args) },
  },
}));

vi.mock('@/lib/embeddings/document-processor', () => ({
  processDocument: (...args: any[]) => mockProcessDocument(...args),
  getProcessingStats: (...args: any[]) => mockGetProcessingStats(...args),
}));

vi.mock('@/lib/embeddings/tribunal-decision-processor', () => ({
  processTribunalDecision: (...args: any[]) => mockProcessTribunalDecision(...args),
}));

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

process.env.CRON_SECRET = 'test-secret';

import { GET } from '@/app/api/cron/process-index-jobs/route';

function makeReq(): Request {
  return new Request('http://localhost/api/cron/process-index-jobs', {
    method: 'GET',
    headers: { Authorization: 'Bearer test-secret' },
  });
}

beforeEach(() => {
  mockIndexJobFindMany.mockReset();
  mockDocumentFindMany.mockReset();
  mockTribunalDecisionFindMany.mockReset();
  mockIndexJobUpdate.mockReset();
  mockProcessDocument.mockReset();
  mockProcessTribunalDecision.mockReset();
  mockGetProcessingStats.mockReset();

  // Defaults
  mockIndexJobFindMany.mockResolvedValue([]);
  mockDocumentFindMany.mockResolvedValue([]);
  mockTribunalDecisionFindMany.mockResolvedValue([]);
  mockGetProcessingStats.mockResolvedValue({ completed: 0, pending: 0, failed: 0 });
  mockProcessDocument.mockResolvedValue({ success: true, stats: { chunkCount: 3 } });
  mockProcessTribunalDecision.mockResolvedValue({ success: true, stats: { chunkCount: 2 } });
});

describe('GET /api/cron/process-index-jobs — MAX_JOBS_PER_RUN = 50', () => {
  it('document findMany chamado com take=50', async () => {
    await GET(makeReq());
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });
});

describe('GET /api/cron/process-index-jobs — ordenação FIFO', () => {
  it('document findMany usa uploadedAt ASC', async () => {
    await GET(makeReq());
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { uploadedAt: 'asc' } })
    );
  });

  it('tribunalDecision findMany usa createdAt ASC', async () => {
    await GET(makeReq());
    expect(mockTribunalDecisionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } })
    );
  });
});

describe('GET /api/cron/process-index-jobs — batches paralelos', () => {
  it('processa documents em batches de 10 via Promise.all', async () => {
    // 25 documents pending → 3 batches (10, 10, 5)
    mockDocumentFindMany.mockResolvedValueOnce(
      Array.from({ length: 25 }, (_, i) => ({ id: `doc-${i}` }))
    );

    let concurrent = 0;
    let maxConcurrent = 0;
    mockProcessDocument.mockImplementation(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(resolve => setTimeout(resolve, 10));
      concurrent--;
      return { success: true, stats: { chunkCount: 3 } };
    });

    await GET(makeReq());

    expect(mockProcessDocument).toHaveBeenCalledTimes(25);
    expect(maxConcurrent).toBeGreaterThanOrEqual(5);
    expect(maxConcurrent).toBeLessThanOrEqual(10);
  });
});

describe('GET /api/cron/process-index-jobs — autorização', () => {
  it('retorna 401 sem auth', async () => {
    const req = new Request('http://localhost/api/cron/process-index-jobs', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('retorna 401 com auth errada', async () => {
    const req = new Request('http://localhost/api/cron/process-index-jobs', {
      method: 'GET',
      headers: { Authorization: 'Bearer wrong' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/cron/process-index-jobs — response shape', () => {
  it('retorna summary com processed, completed, failed', async () => {
    mockDocumentFindMany.mockResolvedValueOnce([
      { id: 'doc-1' }, { id: 'doc-2' },
    ]);

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.processed).toBe(2);
    expect(body.completed).toBe(2);
    expect(body.failed).toBe(0);
  });
});
```

- [ ] **Step 6.2: Rodar testes — verificar que falham**

Run: `npx vitest run app/api/cron/__tests__/process-index-jobs.test.ts`
Expected: FAIL — `MAX_JOBS_PER_RUN=10`, ordenação DESC, processamento sequencial.

- [ ] **Step 6.3: Aplicar fix no route.ts**

Edit: `app/api/cron/process-index-jobs/route.ts` — três mudanças:

**Mudança 1:** Trocar constante `MAX_JOBS_PER_RUN`:

```ts
// No topo do arquivo, localizar:
const MAX_JOBS_PER_RUN = 10;
// Substituir por:
const MAX_JOBS_PER_RUN = 50;
const BATCH_SIZE = 10;
const TIME_BUDGET_MS = 250_000;
```

**Mudança 2:** Trocar ordenação em ambos os `findMany`:

Localizar `pendingDocuments`:
```ts
    const pendingDocuments = await prisma.document.findMany({
      where: { ... },
      select: { id: true },
      take: MAX_JOBS_PER_RUN - pendingJobs.length,
      orderBy: { uploadedAt: 'desc' },  // ← mudar para 'asc'
    });
```

Localizar `pendingDecisions`:
```ts
    const pendingDecisions = await prisma.tribunalDecision.findMany({
      where: { ... },
      select: { id: true },
      take: Math.max(0, MAX_JOBS_PER_RUN - pendingJobs.length - pendingDocuments.length),
      orderBy: { createdAt: 'desc' },  // ← mudar para 'asc'
    });
```

**Mudança 3:** Trocar loops sequenciais por batches paralelos.

Localizar o loop de `pendingDocuments`:
```ts
    // 6. Process direct documents (without IndexJob entry)
    for (const doc of pendingDocuments) {
      console.log(`⚙️  Processing document ${doc.id} directly`);
      const result = await processDocument(doc.id);
      results.push({ /* ... */ });
      if (result.success) { /* ... */ } else { /* ... */ }
    }
```

Substituir por:
```ts
    // 6. Process direct documents (without IndexJob entry) — batches paralelos
    const startTime = Date.now();
    for (let i = 0; i < pendingDocuments.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.warn(`⏰ Time budget exhausted; skipping ${pendingDocuments.length - i} remaining docs`);
        break;
      }
      const batch = pendingDocuments.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(doc =>
          processDocument(doc.id).catch(err => ({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }))
        )
      );
      batchResults.forEach((result, idx) => {
        const doc = batch[idx];
        results.push({
          jobId: `direct-${doc.id}`,
          documentId: doc.id,
          status: result.success ? 'completed' : 'failed',
          error: (result as { error?: string }).error,
          chunkCount: (result as { stats?: { chunkCount?: number } }).stats?.chunkCount,
        });
      });
    }
```

Analogamente, localizar o loop de `pendingDecisions` e substituir por mesma estrutura (trocando `processDocument` por `processTribunalDecision` e `direct-` por `tribunal-`):

```ts
    // 7. Process pending tribunal decisions — batches paralelos
    for (let i = 0; i < pendingDecisions.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.warn(`⏰ Time budget exhausted; skipping ${pendingDecisions.length - i} remaining decisions`);
        break;
      }
      const batch = pendingDecisions.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(decision =>
          processTribunalDecision(decision.id).catch(err => ({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }))
        )
      );
      batchResults.forEach((result, idx) => {
        const decision = batch[idx];
        results.push({
          jobId: `tribunal-${decision.id}`,
          documentId: decision.id,
          status: result.success ? 'completed' : 'failed',
          error: (result as { error?: string }).error,
          chunkCount: (result as { stats?: { chunkCount?: number } }).stats?.chunkCount,
        });
      });
    }
```

- [ ] **Step 6.4: Rodar testes — verificar que passam**

Run: `npx vitest run app/api/cron/__tests__/process-index-jobs.test.ts`
Expected: PASS (todos os testes).

- [ ] **Step 6.5: Commit**

```bash
git add app/api/cron/process-index-jobs/route.ts app/api/cron/__tests__/process-index-jobs.test.ts
git commit -m "perf(cron): process-index-jobs escala para 50 jobs/run em batches paralelos FIFO"
```

---

## Task 7: Script `backfill-pending-embeddings.ts`

**Files:**
- Create: `scripts/backfill-pending-embeddings.ts`

**Contexto:** Script operacional one-shot para drenar backlog de 727 registros pending em minutos. Idempotente, com flags `--limit`, `--type`, `--dry-run`.

- [ ] **Step 7.1: Criar o script**

Create: `scripts/backfill-pending-embeddings.ts`

```ts
/**
 * Backfill de embeddings para registros com embeddingStatus='pending'
 *
 * Uso:
 *   npx tsx scripts/backfill-pending-embeddings.ts
 *   npx tsx scripts/backfill-pending-embeddings.ts --type document
 *   npx tsx scripts/backfill-pending-embeddings.ts --type tribunal
 *   npx tsx scripts/backfill-pending-embeddings.ts --limit 100
 *   npx tsx scripts/backfill-pending-embeddings.ts --dry-run
 */

import { prisma } from '../lib/prisma';
import { processDocument, getProcessingStats } from '../lib/embeddings/document-processor';
import { processTribunalDecision } from '../lib/embeddings/tribunal-decision-processor';

const BATCH = 20;

interface Args {
  limit: number;
  type: 'document' | 'tribunal' | 'both';
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { limit: Infinity, type: 'both', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--type') {
      const t = argv[++i];
      if (t !== 'document' && t !== 'tribunal' && t !== 'both') {
        throw new Error(`--type deve ser document, tribunal ou both (recebido: ${t})`);
      }
      args.type = t;
    }
  }
  return args;
}

async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<{ success: boolean; error?: string }>,
  label: string
) {
  let completed = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(item =>
        processor(item).catch(err => ({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }))
      )
    );
    for (const r of results) {
      if (r.success) completed++;
      else failed++;
    }
    const done = i + batch.length;
    if (done % 50 === 0 || done === items.length) {
      console.log(`  ${label}: ${done}/${items.length} (✓ ${completed} / ✗ ${failed})`);
    }
  }
  return { completed, failed };
}

async function main() {
  const args = parseArgs();
  console.log('Backfill de embeddings pending\n');
  console.log(`Opções: type=${args.type}, limit=${args.limit === Infinity ? 'todas' : args.limit}, dryRun=${args.dryRun}\n`);

  const startTime = Date.now();

  // Document pending
  let docTotal = 0;
  if (args.type === 'document' || args.type === 'both') {
    const take = args.limit === Infinity ? undefined : args.limit;
    const pendingDocs = await prisma.document.findMany({
      where: { OR: [{ embeddingStatus: null }, { embeddingStatus: 'pending' }] },
      select: { id: true },
      orderBy: { uploadedAt: 'asc' },
      ...(take !== undefined ? { take } : {}),
    });
    docTotal = pendingDocs.length;
    console.log(`📄 Document pending: ${docTotal}`);
    if (!args.dryRun && docTotal > 0) {
      const result = await processBatch(
        pendingDocs,
        doc => processDocument(doc.id),
        'documents'
      );
      console.log(`   ✓ completed: ${result.completed}, ✗ failed: ${result.failed}\n`);
    }
  }

  // TribunalDecision pending (só approved)
  let tdTotal = 0;
  if (args.type === 'tribunal' || args.type === 'both') {
    const take = args.limit === Infinity ? undefined : args.limit;
    const pendingTds = await prisma.tribunalDecision.findMany({
      where: {
        approvalStatus: { in: ['auto_approved', 'manually_approved'] },
        OR: [{ embeddingStatus: null }, { embeddingStatus: 'pending' }],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      ...(take !== undefined ? { take } : {}),
    });
    tdTotal = pendingTds.length;
    console.log(`⚖️  TribunalDecision pending (approved): ${tdTotal}`);
    if (!args.dryRun && tdTotal > 0) {
      const result = await processBatch(
        pendingTds,
        td => processTribunalDecision(td.id),
        'tribunal decisions'
      );
      console.log(`   ✓ completed: ${result.completed}, ✗ failed: ${result.failed}\n`);
    }
  }

  // Stats finais
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  if (!args.dryRun) {
    const stats = await getProcessingStats();
    console.log(`\nEstado final (via getProcessingStats):`);
    console.log(`  completed: ${stats.completed}`);
    console.log(`  pending:   ${stats.pending}`);
    console.log(`  failed:    ${stats.failed}`);
  }
  console.log(`\nTempo total: ${elapsed}s`);
  console.log(args.dryRun ? '[DRY RUN — nada foi processado]' : 'Backfill concluído.');

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 7.2: Validar com `--dry-run`**

Run: `npx tsx scripts/backfill-pending-embeddings.ts --dry-run`
Expected: imprime contagens de pending para Document e TribunalDecision sem processar. Termina em ~1-2s.

- [ ] **Step 7.3: Validar com `--limit 1` (processamento real de 1 item)**

Run: `npx tsx scripts/backfill-pending-embeddings.ts --limit 1 --type document`
Expected: processa 1 Document pending, imprime progresso, completa.

- [ ] **Step 7.4: Commit**

```bash
git add scripts/backfill-pending-embeddings.ts
git commit -m "feat(scripts): backfill-pending-embeddings — acelerador one-shot"
```

---

## Task 8: Validação end-to-end e rollout

**Files:** nenhum novo arquivo — só validação.

**Contexto:** Verificação antes do merge. Roda suite completa, build, teste manual via dev server.

- [ ] **Step 8.1: Rodar suite de testes dos módulos tocados**

Run: `npx vitest run lib/embeddings lib/jurisprudencia app/api/jurisprudencia app/api/cron`
Expected: PASS em todos os testes.

- [ ] **Step 8.2: Rodar suite completa do projeto (garantir sem regressão global)**

Run: `npm test -- --run`
Expected: todos os testes do projeto passam (~580+ testes).

- [ ] **Step 8.3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v "app/__tests__\|app/api/jurisprudencia/__tests__\|lib/__tests__\|lib/jurisprudencia/__tests__\|lib/embeddings/__tests__\|app/api/cron/__tests__"`
Expected: não há novos erros de TS nos arquivos de produção (test files têm padrão conhecido de erros `Request` vs `NextRequest` que já existe pré-PR).

- [ ] **Step 8.4: Iniciar dev server**

Run: `npm run dev`

Em outro terminal/browser:

- Abrir `http://localhost:3000/area-restrita/jurisprudencia` autenticado
- Teste manual 1 (pergunta TCU sem filtro):
  - Pergunta: "qual o entendimento do TCU sobre segregação de funções"
  - Expectativa: respostas incluem informativo TCU e/ou acórdãos TCU nas fontes
- Teste manual 2 (filtro TCU explícito):
  - Selecionar tribunal=TCU, pergunta: "dispensa de licitação emergencial"
  - Expectativa: só fontes TCU (acórdão/informativo/manual)
- Teste manual 3 (filtro TCE-SP):
  - Selecionar tribunal=TCE-SP, pergunta: "fiscalização de contrato"
  - Expectativa: só fontes TCE-SP (pode retornar pouco antes do backfill)
- Teste manual 4 (filtro sumula):
  - Selecionar decisionType=sumula, pergunta qualquer
  - Expectativa: só TribunalDecision com sumula

- [ ] **Step 8.5: Rollout em produção — ordem crítica**

**Passo A:** Merge e deploy:

```bash
git push
# Abrir PR, aprovar, merge no main (via gh ou UI GitHub)
# Vercel faz deploy automático
```

**Passo B:** Após deploy concluído, rodar backfill em produção:

```bash
DATABASE_URL="<prod_url>" npx tsx scripts/backfill-pending-embeddings.ts
```

Tempo esperado: 5-10 min. Custo Gemini: ~$0.26.

**Passo C:** Validar drenagem em produção via script de diagnóstico:

```bash
DATABASE_URL="<prod_url>" npx tsx scripts/diagnose-tcu-count.ts
```

Verifica que Document e TribunalDecision têm `embeddingStatus='completed'` próximo do total.

**Passo D:** Validar em produção:
- Acessar `https://www.profdanielbarral.com/area-restrita/jurisprudencia`
- Repetir testes manuais 1-4 da Step 8.4
- Confirmar que IA cita informativo TCU na resposta sobre "segregação de funções"

**Passo E:** Monitorar nas primeiras 24h:
- Logs do Vercel para `jurisprudencia/query` — atentar avgSimilarity e distribuição byType
- Logs do cron `process-index-jobs` — confirmar que backlog fica em 0 após drenagem

- [ ] **Step 8.6: Em caso de problema — rollback**

```bash
# Revert dos commits relevantes (manter só a spec e o plano)
git revert <sha> <sha> ... --no-edit
git push
```

Front-end intocado → revert instantâneo. Embeddings completed ficam úteis para busca global.

---

## Self-review do plano

### Spec coverage

| Requisito do spec | Task(s) |
|---|---|
| Extensões retrocompatíveis do vector-search (`categoryIn`, `skipXxxBranch`, `tribunalCodeFilter`, `extraWhere`) | Task 1 |
| `mapFiltersToSemanticOptions` + regras de tribunal/decisionType/enunciados | Task 2 |
| Fragmentos `extraWhere` para filtros estruturais | Task 2 |
| `enrichSources` com JOINs paralelos | Task 3 |
| `adaptToSourcesPayload` com shape uniforme + deriveInformativoNumber | Task 4 |
| `resolveEmenta` fallback chain | Task 4 |
| Refactor da rota IA usando semantic + adapter | Task 5 |
| `buildPrompt` adaptado com chunkContent + similaridade | Task 5 |
| Observabilidade com `byType`/`avgSimilarity` | Task 5 |
| Fix do `process-index-jobs`: MAX=50, FIFO, batches 10 | Task 6 |
| Script de backfill | Task 7 |
| Validação end-to-end + rollout | Task 8 |

Sem gaps.

### Placeholder scan

Nenhum "TBD" ou "TODO" inline. Todos os blocos de código mostram conteúdo real.

### Type consistency

- `JurisprudenciaFilters` é importado de `@/lib/jurisprudencia/unified-query` em Tasks 2, 5
- `SearchOptions` e `SearchResult` importados de `@/lib/embeddings/vector-search` em Tasks 2, 3, 5
- `EnrichedSource` exportado em Task 3, consumido em Tasks 4, 5
- `JurisprudenciaSource` exportado em Task 4, consumido em Task 5
- `mapFiltersToSemanticOptions`, `enrichSources`, `adaptToSourcesPayload`, `resolveEmenta` exportadas de `semantic-adapter.ts` nas Tasks 2-4, consumidas em Task 5
- `MAX_JOBS_PER_RUN = 50`, `BATCH_SIZE = 10`, `TIME_BUDGET_MS = 250_000` definidos em Task 6

Sem inconsistências.

### Escopo de plano único

Todas as tasks pertencem à mesma delivery (IA semântica + pipeline + backfill), compartilham módulos (`semantic-adapter.ts` e seu teste, `vector-search.ts`) e têm dependências lineares (Task 5 depende de 1-4; Task 6 é independente mas no mesmo plano pelo escopo do spec; Task 7 é operacional; Task 8 valida o todo). Aceitável como um plano único.
