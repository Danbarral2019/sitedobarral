# BIA-0b — Motor híbrido na lista de documentos da busca logada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o motor da seção de **documentos + atos legislativos** da lista de resultados da área logada de FTS puro para o motor **híbrido** (vetor+FTS), num segundo passe que faz upgrade da lista FTS instantânea — sem regressão de velocidade, sem custo de Claude, sem vazar documento restrito.

**Architecture:** Duas fases. Fase 1 (inalterada): `global-search` FTS a 300ms → lista instantânea. Fase 2 (nova): endpoint dedicado `/api/area-restrita/global-search/hybrid` roda `hybridSearch`, pós-filtra por matrícula, deduplica por documento e re-hidrata o shape completo via Prisma; o hook mescla esses resultados nas seções `document`/`legislative-act` da lista (debounce ~800ms + no Enter), com fallback gracioso para o FTS.

**Tech Stack:** Next.js 15 App Router (route handlers), TypeScript, Prisma (PrismaNeon), Vitest, `lib/embeddings/hybrid-search`, `lib/embeddings/vector-search`.

## ✅ STATUS DE EXECUÇÃO — 2026-07-08 (via subagent-driven development)

**Todas as 7 tasks + fix wave concluídas. Branch `feat/bia-0b-busca-hibrida`, PR #132 ABERTA (não mergeada — aguarda OK do Daniel; merge = produção).**

- **T1** helpers puros (`lib/search/hybrid-documents.ts`): `filterByEnrollment`, `dedupeByDocument`, `TYPE_PRIORITY`, `sortByTypePriority` (estável). Review pegou Critical: helper de teste sem `chunkIndex` (quebrava build) → corrigido.
- **T2** mapeadores Prisma→shape. Review pegou Critical **e o plano estava errado**: `LegislativeAct` usa coluna nativa `leiArticlesArr String[]`, não a `leiArticles` JSON (dropada na Onda 4.5.6) → plano E código corrigidos p/ `leiArticlesArr`.
- **T3** `mergeHybridIntoResults` (substitui só document/legislative-act, preserva relevância). Approved.
- **T4** endpoint `GET /api/area-restrita/global-search/hybrid` (auth → hybridSearch → **pós-filtro de matrícula ANTES da hidratação** → dedupe → hidrata → responde; fallback 200 `{results:[]}`). Review verificou os 3 riscos de segurança limpos. Approved.
- **T5** wire no hook (`use-global-search.ts`): debounce 800ms + Enter + merge via functional setState. Implementer pegou bug de **TDZ** (reordenou `searchHybrid`). Approved.
- **T6** registrou **BIA-0c** no `FUTURE_TASKS.md` (card de IA não filtra por matrícula — item separado).
- **Review final de branch (opus): "With fixes"** — 1 Important: **race de resposta híbrida obsoleta** (setQuery não abortava o controller em voo → resposta antiga sobrescrevia a lista ~1s). **Fix wave (commit `0e6e54ad`):** aborta híbrido ao trocar query + `restoreSnapshot` limpa refs + padrão de erro Fase 8 na rota (fallback raw preservado).
- **11 testes verdes, `npm run build` OK.**
- **T7 VERIFICADO no preview de produção:** rede `FTS→HYBRID→AICARD` (endpoint dispara); documentos semânticos na lista (Orientação Normativa AGU, Inf. Contratação Direta, Parecer Vinculante) com scores de similaridade para "quando posso contratar **sem licitação**" — sem keyword match; `suspense_flash=0`, foco intacto (BIA-0a sem regressão); acesso OK.
- **Deferidos (Minor, ver ledger `.superpowers/sdd/progress.md`):** T3a (merge não filtra `hybrid` por tipo defensivamente), T3b (asserção redundante), T4a (branch q<2 sem teste), T5b (ordem check/abort), **#3 counts desync** (badge do tipo document não recomputa após o upgrade — visível, fácil), #4 multi-curso over-restriction (pré-existente).

**PRÓXIMO:** Daniel decide o merge da #132. Ao mergear: atualizar o painel de frentes ([[painel-frentes-control-tower]]) marcando BIA-0b entregue (fecha o BIA-0 inteiro: 0a piscar + 0b motor híbrido).

## Global Constraints

- **Acesso (INEGOCIÁVEL):** documentos só aparecem se `isCommon === true` OU `courseId` vazio OU `enrolledCourseIds.includes(courseId)`. Admin vê tudo (`enrolledCourseIds = todos os cursos`), como no `global-search`.
- **Custo:** nenhuma chamada a Claude. O embedding da query é cacheado (`hybridSearch`/`vector-search` já usam `useCache`) — reaproveitado do card de IA.
- **Zero regressão:** qualquer falha do híbrido (erro, timeout, embedding indisponível, Redis off) mantém os resultados FTS já exibidos. Nunca esvaziar a lista por falha do upgrade.
- **Escopo de tipos:** só `document` e `legislative-act` migram para híbrido. `lei`, `glossary`, `faq`, `video`, `blog`, `site` continuam FTS.
- **Ordem semântica:** dentro do tipo `document`/`legislative-act`, preservar a ordem do híbrido (relevância). NÃO reordenar documentos por `docCategoryPriority` (isso é do FTS).
- **Testes:** Vitest, `// @vitest-environment node` nas rotas, mocks via `vi.hoisted` + `vi.mock` (padrão de `app/api/documents/query/__tests__/quota-degradation.test.ts`).
- **Commits:** frequentes, um por task.

---

## File Structure

- **Create `lib/search/hybrid-documents.ts`** — helpers puros da Fase 2: filtro de acesso, dedupe por documento, mapeadores de linha Prisma → `DocumentResult`/`LegislativeActResult`, ordenação por prioridade de tipo, e o merge FTS×híbrido. Tudo puro e testável isoladamente.
- **Create `lib/search/__tests__/hybrid-documents.test.ts`** — testes dos helpers.
- **Create `app/api/area-restrita/global-search/hybrid/route.ts`** — o endpoint da Fase 2.
- **Create `app/api/area-restrita/global-search/hybrid/__tests__/route.test.ts`** — testes do endpoint.
- **Modify `hooks/use-global-search.ts`** — nova fase (debounce ~800ms + trigger no Enter + fetch + merge).
- **Modify `FUTURE_TASKS.md`** — registrar o achado do card de IA (não filtra por matrícula) como item separado.

---

### Task 1: Helpers puros — acesso, dedupe, ordenação

**Files:**
- Create: `lib/search/hybrid-documents.ts`
- Test: `lib/search/__tests__/hybrid-documents.test.ts`

**Interfaces:**
- Consumes: `SearchResult` de `@/lib/embeddings/vector-search`; `SearchResultItem`, `ContentType` de `@/lib/types/global-search`.
- Produces:
  - `filterByEnrollment(results: SearchResult[], enrolledCourseIds: string[]): SearchResult[]`
  - `dedupeByDocument(results: SearchResult[]): SearchResult[]`
  - `TYPE_PRIORITY: Record<string, number>`
  - `sortByTypePriority(items: SearchResultItem[]): SearchResultItem[]`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/search/__tests__/hybrid-documents.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { filterByEnrollment, dedupeByDocument, sortByTypePriority } from '../hybrid-documents';

function sr(over: Partial<import('@/lib/embeddings/vector-search').SearchResult>) {
  return {
    documentId: 'd1', documentTitle: 't', category: 'apostila', chunkContent: 'c',
    similarity: 0.5, isCommon: false, sourceType: 'document' as const, ...over,
  };
}

describe('filterByEnrollment', () => {
  it('mantém isCommon, sem-curso e curso matriculado; remove curso não-matriculado', () => {
    const results = [
      sr({ documentId: 'a', isCommon: true, courseId: 'x' }),   // comum → mantém
      sr({ documentId: 'b', isCommon: false, courseId: undefined }), // sem curso → mantém
      sr({ documentId: 'c', isCommon: false, courseId: '3' }),  // matriculado → mantém
      sr({ documentId: 'd', isCommon: false, courseId: '99' }), // NÃO matriculado → remove
    ];
    const kept = filterByEnrollment(results, ['3', '10']).map(r => r.documentId);
    expect(kept).toEqual(['a', 'b', 'c']);
  });
});

describe('dedupeByDocument', () => {
  it('mantém 1 por documentId, com a maior similarity, preservando a ordem de 1ª aparição', () => {
    const results = [
      sr({ documentId: 'a', similarity: 0.9 }),
      sr({ documentId: 'b', similarity: 0.8 }),
      sr({ documentId: 'a', similarity: 0.95 }), // duplicado de 'a', maior score
    ];
    const out = dedupeByDocument(results);
    expect(out.map(r => r.documentId)).toEqual(['a', 'b']);
    expect(out[0].similarity).toBe(0.95);
  });
});

describe('sortByTypePriority', () => {
  it('ordena por prioridade de tipo e preserva a ordem interna (estável)', () => {
    const items = [
      { type: 'document', data: { id: 'doc2' } },
      { type: 'glossary', data: { id: 'g1' } },
      { type: 'document', data: { id: 'doc1' } },
      { type: 'legislative-act', data: { id: 'act1' } },
    ] as any;
    const out = sortByTypePriority(items).map((i: any) => i.data.id);
    // glossary(1) < document(3) < legislative-act(4); docs mantêm ordem doc2, doc1
    expect(out).toEqual(['g1', 'doc2', 'doc1', 'act1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/search/__tests__/hybrid-documents.test.ts`
Expected: FAIL — `Cannot find module '../hybrid-documents'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/search/hybrid-documents.ts
import type { SearchResult } from '@/lib/embeddings/vector-search';
import type { SearchResultItem } from '@/lib/types/global-search';

/** Pós-filtro de acesso: documento aparece se comum, sem curso, ou de curso matriculado. */
export function filterByEnrollment(
  results: SearchResult[],
  enrolledCourseIds: string[],
): SearchResult[] {
  const enrolled = new Set(enrolledCourseIds);
  return results.filter(
    (r) => r.isCommon || !r.courseId || enrolled.has(r.courseId),
  );
}

/** Deduplica por documentId: mantém o chunk de maior similarity, na ordem de 1ª aparição. */
export function dedupeByDocument(results: SearchResult[]): SearchResult[] {
  const best = new Map<string, SearchResult>();
  const order: string[] = [];
  for (const r of results) {
    const existing = best.get(r.documentId);
    if (!existing) {
      best.set(r.documentId, r);
      order.push(r.documentId);
    } else if (r.similarity > existing.similarity) {
      best.set(r.documentId, r);
    }
  }
  return order.map((id) => best.get(id)!);
}

/** Prioridade de exibição por tipo (espelha o global-search). Menor = mais acima. */
export const TYPE_PRIORITY: Record<string, number> = {
  glossary: 1,
  faq: 1.5,
  'course-material': 2,
  document: 3,
  'legislative-act': 4,
  lei: 5,
  video: 6,
  blog: 6.5,
  site: 7,
};

/** Ordena por prioridade de tipo, ESTÁVEL (preserva a ordem interna — ex.: relevância do híbrido). */
export function sortByTypePriority(items: SearchResultItem[]): SearchResultItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const pa = TYPE_PRIORITY[a.item.type] ?? 10;
      const pb = TYPE_PRIORITY[b.item.type] ?? 10;
      return pa !== pb ? pa - pb : a.i - b.i; // desempate por índice = estável
    })
    .map(({ item }) => item);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/search/__tests__/hybrid-documents.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/search/hybrid-documents.ts lib/search/__tests__/hybrid-documents.test.ts
git commit -m "feat(busca): helpers puros do upgrade híbrido (acesso, dedupe, ordenação)"
```

---

### Task 2: Mapeadores de linha Prisma → resultado da lista

**Files:**
- Modify: `lib/search/hybrid-documents.ts`
- Test: `lib/search/__tests__/hybrid-documents.test.ts`

**Interfaces:**
- Consumes: `DocumentResult`, `LegislativeActResult` de `@/lib/types/global-search`; `parseLeiArticles` de `@/lib/lei-articles`; `courses` de `@/data/courses`.
- Produces:
  - `mapDocumentRowToResult(row: DocRow): DocumentResult` (tipo `DocRow` exportado)
  - `mapActRowToResult(row: ActRow): LegislativeActResult` (tipo `ActRow` exportado)

- [ ] **Step 1: Write the failing test** (append ao arquivo de teste)

```typescript
import { mapDocumentRowToResult, mapActRowToResult } from '../hybrid-documents';

describe('mapDocumentRowToResult', () => {
  it('mapeia linha do Document para DocumentResult com courseName resolvido', () => {
    const row = {
      id: 'd1', title: 'Apostila', description: 'desc', category: 'apostila',
      type: 'material', url: null, courseId: '3', tags: '["a"]',
      uploadedAt: new Date('2024-01-01T00:00:00Z'), isPublic: false,
    };
    const out = mapDocumentRowToResult(row);
    expect(out.id).toBe('d1');
    expect(out.uploadedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(out.isPublic).toBe(false);
    expect(typeof out.courseName === 'string' || out.courseName === undefined).toBe(true);
  });
});

describe('mapActRowToResult', () => {
  it('mapeia linha do LegislativeAct para LegislativeActResult (leiArticles parseado)', () => {
    const row = {
      id: 'a1', type: 'decreto', fullNumber: 'Decreto 12.000/2024', title: 'T',
      ementa: 'E', summary: null, issuer: 'Presidência',
      publishDate: new Date('2024-02-02T00:00:00Z'), hierarchyLevel: 2,
      leiArticlesArr: ['6', '7'], officialUrl: null, pdfUrl: null,
    };
    const out = mapActRowToResult(row);
    expect(out.id).toBe('a1');
    expect(out.fullNumber).toBe('Decreto 12.000/2024');
    expect(out.leiArticles).toEqual(['6', '7']);
    expect(out.publishDate).toBe('2024-02-02T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/search/__tests__/hybrid-documents.test.ts`
Expected: FAIL — `mapDocumentRowToResult is not a function`.

- [ ] **Step 3: Write minimal implementation** (append em `lib/search/hybrid-documents.ts`)

```typescript
import type { DocumentResult, LegislativeActResult } from '@/lib/types/global-search';
import { courses } from '@/data/courses';

export interface DocRow {
  id: string; title: string; description: string | null; category: string;
  type: string; url: string | null; courseId: string | null; tags: string | null;
  uploadedAt: Date; isPublic: boolean;
}

export interface ActRow {
  id: string; type: string; fullNumber: string; title: string; ementa: string;
  summary: string | null; issuer: string; publishDate: Date; hierarchyLevel: number;
  leiArticlesArr: string[]; officialUrl: string | null; pdfUrl: string | null;
}

function courseName(courseId: string | null): string | undefined {
  if (!courseId) return undefined;
  return courses.find((c) => c.id === courseId)?.title || 'Curso';
}

export function mapDocumentRowToResult(row: DocRow): DocumentResult {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    type: row.type,
    url: row.url,
    courseId: row.courseId,
    courseName: courseName(row.courseId),
    tags: row.tags,
    uploadedAt: row.uploadedAt.toISOString(),
    isPublic: row.isPublic,
  };
}

export function mapActRowToResult(row: ActRow): LegislativeActResult {
  return {
    id: row.id,
    type: row.type,
    fullNumber: row.fullNumber,
    title: row.title,
    ementa: row.ementa,
    summary: row.summary,
    issuer: row.issuer,
    publishDate: row.publishDate.toISOString(),
    hierarchyLevel: row.hierarchyLevel,
    leiArticles: row.leiArticlesArr, // LegislativeAct usa coluna nativa String[] (Onda 4.5.6; JSON legada dropada)
    officialUrl: row.officialUrl,
    pdfUrl: row.pdfUrl,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/search/__tests__/hybrid-documents.test.ts`
Expected: PASS (5 testes no total).

- [ ] **Step 5: Commit**

```bash
git add lib/search/hybrid-documents.ts lib/search/__tests__/hybrid-documents.test.ts
git commit -m "feat(busca): mapeadores Prisma row -> DocumentResult/LegislativeActResult"
```

---

### Task 3: Função de merge FTS × híbrido

**Files:**
- Modify: `lib/search/hybrid-documents.ts`
- Test: `lib/search/__tests__/hybrid-documents.test.ts`

**Interfaces:**
- Produces: `mergeHybridIntoResults(fts: SearchResultItem[], hybrid: SearchResultItem[]): SearchResultItem[]`

- [ ] **Step 1: Write the failing test** (append)

```typescript
import { mergeHybridIntoResults } from '../hybrid-documents';

describe('mergeHybridIntoResults', () => {
  it('substitui só document + legislative-act pelos híbridos, mantém os outros tipos, ordena por prioridade preservando a ordem do híbrido', () => {
    const fts = [
      { type: 'glossary', data: { id: 'g1' } },
      { type: 'document', data: { id: 'ftsDocA' } },
      { type: 'document', data: { id: 'ftsDocB' } },
      { type: 'legislative-act', data: { id: 'ftsAct' } },
      { type: 'lei', data: { numero: '75' } },
    ] as any;
    const hybrid = [
      { type: 'document', data: { id: 'hybDoc1' } },       // relevância 1º
      { type: 'legislative-act', data: { id: 'hybAct1' } },
      { type: 'document', data: { id: 'hybDoc2' } },       // relevância 2º
    ] as any;

    const out = mergeHybridIntoResults(fts, hybrid).map((i: any) => i.data.id ?? i.data.numero);
    // glossary(1), depois documents do HÍBRIDO na ordem hybDoc1, hybDoc2, depois act híbrido, depois lei
    expect(out).toEqual(['g1', 'hybDoc1', 'hybDoc2', 'hybAct1', '75']);
    // nenhum documento/ato do FTS sobrou
    expect(out).not.toContain('ftsDocA');
    expect(out).not.toContain('ftsAct');
  });

  it('híbrido vazio → devolve o FTS ordenado (fallback do merge é neutro)', () => {
    const fts = [{ type: 'document', data: { id: 'ftsDocA' } }] as any;
    const out = mergeHybridIntoResults(fts, []).map((i: any) => i.data.id);
    expect(out).toEqual(['ftsDocA']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/search/__tests__/hybrid-documents.test.ts`
Expected: FAIL — `mergeHybridIntoResults is not a function`.

- [ ] **Step 3: Write minimal implementation** (append)

```typescript
/**
 * Mescla a lista FTS com os resultados híbridos: substitui TODAS as seções
 * document + legislative-act pelas híbridas (na ordem de relevância do híbrido),
 * mantém os demais tipos do FTS e reordena por prioridade de tipo (estável).
 * Se `hybrid` estiver vazio, devolve o FTS ordenado (sem esvaziar nada).
 */
export function mergeHybridIntoResults(
  fts: SearchResultItem[],
  hybrid: SearchResultItem[],
): SearchResultItem[] {
  if (hybrid.length === 0) return sortByTypePriority(fts);
  const HYBRID_TYPES = new Set(['document', 'legislative-act']);
  const kept = fts.filter((i) => !HYBRID_TYPES.has(i.type));
  return sortByTypePriority([...kept, ...hybrid]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/search/__tests__/hybrid-documents.test.ts`
Expected: PASS (7 testes no total).

- [ ] **Step 5: Commit**

```bash
git add lib/search/hybrid-documents.ts lib/search/__tests__/hybrid-documents.test.ts
git commit -m "feat(busca): merge FTS x hibrido (substitui doc/ato, preserva relevancia)"
```

---

### Task 4: Endpoint `/api/area-restrita/global-search/hybrid`

**Files:**
- Create: `app/api/area-restrita/global-search/hybrid/route.ts`
- Test: `app/api/area-restrita/global-search/hybrid/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `hybridSearch` de `@/lib/embeddings/hybrid-search`; `filterByEnrollment`, `dedupeByDocument`, `mapDocumentRowToResult`, `mapActRowToResult` de `@/lib/search/hybrid-documents`; `verifyToken` de `@/lib/auth`; `prisma` de `@/lib/prisma`.
- Produces: `GET` handler que responde `{ results: SearchResultItem[] }` (só tipos `document`/`legislative-act`, ordem = relevância do híbrido). Query params: `q` (obrigatório, min 2 chars), `limit` (opcional, default 40).

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/area-restrita/global-search/hybrid/__tests__/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyToken, mockHybridSearch, mockUserFind, mockDocFind, mockActFind } = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
  mockHybridSearch: vi.fn(),
  mockUserFind: vi.fn(),
  mockDocFind: vi.fn(),
  mockActFind: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ verifyToken: (...a: unknown[]) => mockVerifyToken(...a) }));
vi.mock('@/lib/embeddings/hybrid-search', () => ({ hybridSearch: (...a: unknown[]) => mockHybridSearch(...a) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFind(...a) },
    document: { findMany: (...a: unknown[]) => mockDocFind(...a) },
    legislativeAct: { findMany: (...a: unknown[]) => mockActFind(...a) },
  },
}));
vi.mock('@/lib/logger', () => ({ apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { GET } from '../route';
import { NextRequest } from 'next/server';

function req(q: string) {
  const r = new NextRequest(`http://localhost/api/area-restrita/global-search/hybrid?q=${encodeURIComponent(q)}`);
  r.cookies.set('auth-token', 'tok');
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyToken.mockResolvedValue({ userId: 'u1', role: 'student' });
  mockUserFind.mockResolvedValue({ id: 'u1', enrollments: [{ courseId: '3' }] });
  mockDocFind.mockResolvedValue([]);
  mockActFind.mockResolvedValue([]);
});

it('remove documento de curso não-matriculado (acesso) e retorna só os permitidos', async () => {
  mockHybridSearch.mockResolvedValue({ results: [
    { documentId: 'd-ok', category: 'apostila', similarity: 0.9, isCommon: false, courseId: '3', sourceType: 'document' },
    { documentId: 'd-leak', category: 'apostila', similarity: 0.8, isCommon: false, courseId: '99', sourceType: 'document' },
  ] });
  mockDocFind.mockResolvedValue([
    { id: 'd-ok', title: 'OK', description: null, category: 'apostila', type: 'm', url: null, courseId: '3', tags: null, uploadedAt: new Date(), isPublic: false },
  ]);

  const res = await GET(req('dispensa'));
  const body = await res.json();
  expect(res.status).toBe(200);
  const ids = body.results.map((r: { data: { id: string } }) => r.data.id);
  expect(ids).toContain('d-ok');
  expect(ids).not.toContain('d-leak');
  // só pediu hidratação dos IDs permitidos
  expect(mockDocFind).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['d-ok'] } } }));
});

it('401 quando não autenticado', async () => {
  mockVerifyToken.mockResolvedValue(null);
  const res = await GET(req('dispensa'));
  expect(res.status).toBe(401);
});

it('fallback: hybridSearch lança → responde 200 com results vazio (nunca quebra a lista)', async () => {
  mockHybridSearch.mockRejectedValue(new Error('boom'));
  const res = await GET(req('dispensa'));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.results).toEqual([]);
});

it('preserva a ordem de relevância do híbrido (após dedupe/hidratação)', async () => {
  mockHybridSearch.mockResolvedValue({ results: [
    { documentId: 'd2', category: 'apostila', similarity: 0.95, isCommon: true, sourceType: 'document' },
    { documentId: 'd1', category: 'apostila', similarity: 0.90, isCommon: true, sourceType: 'document' },
  ] });
  mockDocFind.mockResolvedValue([
    { id: 'd1', title: 'D1', description: null, category: 'apostila', type: 'm', url: null, courseId: null, tags: null, uploadedAt: new Date(), isPublic: true },
    { id: 'd2', title: 'D2', description: null, category: 'apostila', type: 'm', url: null, courseId: null, tags: null, uploadedAt: new Date(), isPublic: true },
  ]);
  const res = await GET(req('dispensa'));
  const body = await res.json();
  expect(body.results.map((r: { data: { id: string } }) => r.data.id)).toEqual(['d2', 'd1']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/area-restrita/global-search/hybrid/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/api/area-restrita/global-search/hybrid/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { courses } from '@/data/courses';
import { hybridSearch } from '@/lib/embeddings/hybrid-search';
import { apiLogger } from '@/lib/logger';
import {
  filterByEnrollment,
  dedupeByDocument,
  mapDocumentRowToResult,
  mapActRowToResult,
} from '@/lib/search/hybrid-documents';
import type { SearchResultItem } from '@/lib/types/global-search';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DEFAULT_LIMIT = 40;

export async function GET(request: NextRequest) {
  // Auth (mesmo padrão do global-search)
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const authPayload = await verifyToken(token);
  if (!authPayload) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() || '';
  if (query.length < 2) {
    return NextResponse.json({ results: [] } satisfies { results: SearchResultItem[] });
  }
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 100);

  // Matrículas (admin vê todos os cursos)
  const isAdmin = authPayload.role === 'admin';
  const user = await prisma.user.findUnique({
    where: { id: authPayload.userId },
    select: { id: true, enrollments: { select: { courseId: true } } },
  });
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }
  const enrolledCourseIds = isAdmin
    ? courses.map((c) => c.id)
    : user.enrollments.map((e) => e.courseId);

  // Fase 2: híbrido (document + legislative-act). Fallback gracioso em qualquer erro.
  try {
    const { results } = await hybridSearch({
      query,
      limit: Math.ceil(limit * 1.5), // margem para o pós-filtro de acesso
      includeTribunalDecisions: false,
      useCache: true,
    });

    const allowed = dedupeByDocument(filterByEnrollment(results, enrolledCourseIds)).slice(0, limit);

    const docIds = allowed.filter((r) => r.sourceType === 'document').map((r) => r.documentId);
    const actIds = allowed.filter((r) => r.sourceType === 'legislative-act').map((r) => r.documentId);

    const [docRows, actRows] = await Promise.all([
      docIds.length
        ? prisma.document.findMany({
            where: { id: { in: docIds } },
            select: { id: true, title: true, description: true, category: true, type: true, url: true, courseId: true, tags: true, uploadedAt: true, isPublic: true },
          })
        : Promise.resolve([]),
      actIds.length
        ? prisma.legislativeAct.findMany({
            where: { id: { in: actIds } },
            select: { id: true, type: true, fullNumber: true, title: true, ementa: true, summary: true, issuer: true, publishDate: true, hierarchyLevel: true, leiArticlesArr: true, officialUrl: true, pdfUrl: true },
          })
        : Promise.resolve([]),
    ]);

    const docById = new Map(docRows.map((d) => [d.id, d]));
    const actById = new Map(actRows.map((a) => [a.id, a]));

    // Preserva a ordem de relevância do híbrido
    const items: SearchResultItem[] = [];
    for (const r of allowed) {
      if (r.sourceType === 'document') {
        const row = docById.get(r.documentId);
        if (row) items.push({ type: 'document', data: mapDocumentRowToResult(row) });
      } else if (r.sourceType === 'legislative-act') {
        const row = actById.get(r.documentId);
        if (row) items.push({ type: 'legislative-act', data: mapActRowToResult(row) });
      }
    }

    apiLogger.info({ query, count: items.length }, 'hybrid search list upgrade');
    return NextResponse.json({ results: items } satisfies { results: SearchResultItem[] });
  } catch (err) {
    // Zero regressão: falha do híbrido não quebra a lista (o FTS já está exibido).
    apiLogger.warn({ err: err instanceof Error ? err.message : String(err) }, 'hybrid search upgrade failed — degrada para FTS');
    return NextResponse.json({ results: [] } satisfies { results: SearchResultItem[] });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/area-restrita/global-search/hybrid/__tests__/route.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "hybrid" || echo OK`
Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add app/api/area-restrita/global-search/hybrid/
git commit -m "feat(busca): endpoint /global-search/hybrid (acesso + dedupe + hidratacao)"
```

---

### Task 5: Wire da Fase 2 no hook `use-global-search`

**Files:**
- Modify: `hooks/use-global-search.ts`

**Interfaces:**
- Consumes: `mergeHybridIntoResults` de `@/lib/search/hybrid-documents`; endpoint `GET /api/area-restrita/global-search/hybrid`.
- Produces: nenhuma nova API pública do hook — apenas o efeito colateral de fazer upgrade de `results` ~800ms após digitar (e no Enter via `triggerAISearch`).

- [ ] **Step 1: Adicionar import + refs + constante de debounce**

Em `hooks/use-global-search.ts`, adicionar o import (junto aos outros imports de topo):

```typescript
import { mergeHybridIntoResults } from '@/lib/search/hybrid-documents';
```

Após a linha `const aiDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);` (linha ~149), adicionar:

```typescript
  const hybridAbortControllerRef = useRef<AbortController | null>(null);
  const hybridDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const HYBRID_DEBOUNCE_MS = 800;
```

- [ ] **Step 2: Adicionar a função `searchHybrid`**

Logo ANTES de `const setQuery = useCallback(` (linha ~446), adicionar:

```typescript
  // Fase 2 (BIA-0b): upgrade híbrido da seção document/legislative-act da lista.
  // Reaproveita o embedding cacheado (custo ~0). Falha = mantém o FTS (zero regressão).
  const searchHybrid = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < minQueryLength) return;
    if (hybridAbortControllerRef.current) hybridAbortControllerRef.current.abort();
    const controller = new AbortController();
    hybridAbortControllerRef.current = controller;
    try {
      const params = new URLSearchParams({ q: searchQuery });
      const response = await fetch(`/api/area-restrita/global-search/hybrid?${params}`, { signal: controller.signal });
      if (!response.ok) return; // fallback: mantém FTS
      const data: { results: SearchResultItem[] } = await response.json();
      if (controller.signal.aborted || !data.results?.length) return;
      setResults((prev) => mergeHybridIntoResults(prev, data.results));
    } catch {
      // AbortError ou rede: mantém FTS silenciosamente
    }
  }, [minQueryLength]);
```

- [ ] **Step 3: Disparar a Fase 2 no debounce do `setQuery`**

Dentro de `setQuery`, logo após o bloco `// Debounce the AI search (1500ms)` (após a linha `}, aiDebounceMs);` dentro do `if (aiEnabled ...)`), adicionar o timer híbrido:

```typescript
      // Debounce do upgrade híbrido da lista (800ms) — BIA-0b
      if (hybridDebounceTimerRef.current) clearTimeout(hybridDebounceTimerRef.current);
      if (newQuery.length >= minQueryLength) {
        hybridDebounceTimerRef.current = setTimeout(() => {
          searchHybrid(newQuery);
        }, HYBRID_DEBOUNCE_MS);
      }
```

E adicionar `searchHybrid` ao array de deps do `useCallback` do `setQuery` (linha ~497), que passa a ser:

```typescript
    [debounceMs, aiDebounceMs, minQueryLength, search, searchAI, aiEnabled, searchHybrid]
```

- [ ] **Step 4: Disparar a Fase 2 imediatamente no Enter (`triggerAISearch`)**

Dentro de `triggerAISearch` (linha ~424), após cancelar o debounce da IA e antes de disparar `searchAI`, adicionar a chamada imediata do híbrido. Localizar o corpo do `triggerAISearch` e adicionar, junto ao disparo imediato existente:

```typescript
    // Enter também dispara o upgrade híbrido da lista imediatamente (BIA-0b)
    if (hybridDebounceTimerRef.current) clearTimeout(hybridDebounceTimerRef.current);
    if (query.length >= minQueryLength) searchHybrid(query);
```

E incluir `searchHybrid` (e `minQueryLength` se ainda não estiver) nas deps do `useCallback` do `triggerAISearch`.

- [ ] **Step 5: Limpar timers/abort na limpeza e query vazia**

No `clearSearch` (bloco que já limpa `debounceTimerRef`/`abortControllerRef`, linha ~500), adicionar:

```typescript
    if (hybridDebounceTimerRef.current) clearTimeout(hybridDebounceTimerRef.current);
    if (hybridAbortControllerRef.current) hybridAbortControllerRef.current.abort();
```

E no `setQuery`, dentro do bloco `if (!newQuery.trim())` (que limpa tudo, linha ~459), adicionar as mesmas duas linhas antes do `return;`.

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "use-global-search" || echo OK`
Expected: `OK`.

Run: `npm run build 2>&1 | tail -5`
Expected: build conclui sem erro (lista de rotas ao final; deve aparecer `/api/area-restrita/global-search/hybrid`).

- [ ] **Step 7: Commit**

```bash
git add hooks/use-global-search.ts
git commit -m "feat(busca): Fase 2 no hook — upgrade hibrido da lista (debounce 800ms + Enter)"
```

---

### Task 6: Registrar o achado do card de IA + docs

**Files:**
- Modify: `FUTURE_TASKS.md`

- [ ] **Step 1: Registrar o achado** — adicionar, na seção BIA do `FUTURE_TASKS.md` (perto do BIA-0), uma nota curta:

```markdown
### BIA-0c. [ACHADO 2026-07-08] Card de IA não filtra documentos por matrícula [Média]
Ao implementar o BIA-0b, verificou-se que `assembleAnswerContext` chama `hybridSearch` com `courseId: undefined` → o card de IA (e as fontes citadas) pode retornar documentos de cursos em que o aluno NÃO está matriculado. Não é o escopo do BIA-0b (a lista já pós-filtra por matrícula no endpoint /global-search/hybrid). Avaliar: (a) se há documentos restritos de fato expostos no card, (b) aplicar o mesmo pós-filtro por matrícula em `answerContext`/documents/query. Prioridade Média (risco de acesso, mas a maioria do acervo é `isCommon`/público).
```

- [ ] **Step 2: Commit**

```bash
git add FUTURE_TASKS.md
git commit -m "docs(backlog): BIA-0c — card de IA nao filtra docs por matricula (achado)"
```

---

### Task 7: Verificação end-to-end no preview da Vercel

> **Lição do BIA-0a:** o dev local mascara (Fast Refresh serve código velho). Verificar SEMPRE no preview de produção. Ver `[[feedback-nextdynamic-suspense-flash]]`.

- [ ] **Step 1: Abrir PR** (dispara o preview da Vercel automaticamente).

```bash
git push -u origin <branch>
gh pr create --title "feat(busca): motor híbrido na lista de documentos da área logada (BIA-0b)" --body "..."
```

- [ ] **Step 2: Confirmar o deploy READY** (via `gh pr checks <n>` ou a integração Vercel) e pegar a URL do preview.

- [ ] **Step 3: Verificar no navegador (preview):** logar como `aluno@teste.com`/`aluno123`, buscar um termo **semântico** (ex.: "quando posso contratar sem licitação") e confirmar:
  - A lista aparece **instantânea** (FTS) e, ~800ms depois, a seção de documentos **muda para a ordem semântica** (o campo NÃO pisca nem perde foco — BIA-0a).
  - Buscar um termo cujo documento certo **não** casa por palavra-chave mas casa por significado → o documento aparece após o upgrade (prova do ganho).
  - (Acesso) O aluno de teste não vê documento de curso em que não está matriculado.

- [ ] **Step 4: Reportar o resultado** e, aprovado, **atualizar o painel de frentes** (`[[painel-frentes-control-tower]]`) marcando BIA-0b como entregue e reenviar; então mergear.

---

## Self-Review (feito 2026-07-08)

- **Cobertura do spec:** duas fases ✓ (T5); endpoint dedicado ✓ (T4); pós-filtro de acesso ✓ (T1+T4, testado); dedupe ✓ (T1); hidratação/shape ✓ (T2+T4); escopo de tipos document+act ✓ (T4 filtra sourceType); custo ~0 ✓ (`useCache:true`); fallback gracioso ✓ (T4 catch + T5 no-op); merge no frontend ✓ (T3+T5); achado do card de IA registrado ✓ (T6); verificação no preview ✓ (T7).
- **Placeholders:** nenhum — todo passo com código/comando real. (O corpo do PR em T7 fica "..." por ser texto livre no momento da execução.)
- **Consistência de tipos:** `SearchResult` (vector-search), `SearchResultItem`/`DocumentResult`/`LegislativeActResult` (global-search types), `DocRow`/`ActRow` (definidos em T2 e consumidos em T4) — nomes batem entre tasks. `mergeHybridIntoResults`, `filterByEnrollment`, `dedupeByDocument`, `sortByTypePriority`, `mapDocumentRowToResult`, `mapActRowToResult` usados com a mesma assinatura em que foram definidos.
