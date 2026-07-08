# BIA-0b — Motor híbrido na lista de documentos da busca logada — Design

> **Objetivo:** a lista de resultados tradicionais da área logada usa **FTS puro** (palavra-chave) para documentos; só o card de IA usa o **híbrido** (vetor+FTS+RRF). É a primeira impressão do produto. Trazer o híbrido para a lista de documentos, **sem regressão de velocidade** e **sem custo de Claude**.
>
> **Estratégia escolhida (confirmada com Daniel):** **FTS-first + upgrade híbrido** — FTS instantâneo enquanto digita; um instante depois (ou no Enter), a seção de documentos é substituída por resultados semânticos.
>
> **Status:** DESIGN aprovado 2026-07-08. Próximo: writing-plans.

## Contexto / estado atual (verificado 2026-07-08)

- **Lista tradicional:** `GET /api/area-restrita/global-search` (`app/api/area-restrita/global-search/route.ts`) roda FTS multi-tipo em paralelo: `document`, `lei`, `glossary`, `faq`, `video`, `blog`, `site`, `legislative-act`. Só `document` e `legislative-act` vêm do banco (via `lib/search/full-text-search.ts`); os outros são conteúdos fora do corpus vetorial. Filtra documentos por `enrolledCourseIds` (lista) e vídeos/sites por curso. Retorna `SearchResultItem[]` tipados + `counts`.
- **Card de IA:** `POST /api/documents/query` → `assembleAnswerContext` (`lib/rag/answerContext.ts`) → `hybridSearch`. **Chama `hybridSearch` com `courseId: filters.courseId || undefined`** — ou seja, sem `courseId` **não filtra por matrícula** (retorna todos os documentos). O card devolve `meta.results` no formato pobre `AISource` (`documentId, title, category, relevance, excerpt, url` — faltam `type/tags/isPublic/courseName/uploadedAt`).
- **`hybridSearch`** (`lib/embeddings/hybrid-search.ts`): `{ query, courseId?, category?, excludeCategories?, limit?, alpha?, ... }` → `{ results: SearchResult[], ... }`. `SearchResult` = `{ documentId, documentTitle, category, chunkContent, similarity, url?, courseId?, isCommon, tags?, leiArticles?, uploadedAt?, sourceType: 'document'|'legislative-act'|'tribunal-decision' }`. É **chunk-level** (um doc pode ter vários chunks) e cobre `document` + `legislative-act` (UNION). O **embedding da query é cacheado** (`queryEmbedding`, TTL 1h, por hash) → compartilhado com o card de IA.
- **Frontend:** `hooks/use-global-search.ts` orquestra as duas buscas com `AbortController`. `global-search` a 300ms (lista instantânea = `search.results`); `documents/query` a 1500ms/Enter (card de IA = `aiAnswer` + `aiSources`). `SearchResultsList` renderiza ambos.

## Decisões de design

### 1. Duas fases
- **Fase 1 (inalterada):** FTS via `global-search` a 300ms → lista instantânea, todos os tipos. Zero regressão.
- **Fase 2 (NOVA — upgrade):** busca **híbrida só de `document` + `legislative-act`**, disparada em **debounce ~800ms** (entre o FTS 300ms e o card 1500ms) **e imediatamente no submit/Enter**. Ao chegar, **substitui** as seções `document` e `legislative-act` da lista pelos resultados semânticos; os demais tipos permanecem do FTS.

### 2. Endpoint dedicado (não reusar o card de IA)
- **`GET /api/area-restrita/global-search/hybrid`** (nome a confirmar). Motivos para dedicado em vez de reusar `meta.results` do card: (a) o `AISource` é pobre (faltam campos que a lista usa); (b) o card só roda com o toggle de IA ligado; (c) manter o caminho FTS que funciona intocado.
- Mesmo padrão de auth do `global-search` (cookie `auth-token` → `verifyToken` → busca `enrollments`).

### 3. Correção de acesso (INEGOCIÁVEL)
- `hybridSearch` aceita só um `courseId`; a matrícula é uma **lista**. Solução: **pós-filtrar** os resultados por matrícula — manter se `isCommon || !courseId || enrolledCourseIds.includes(courseId)`. `SearchResult` traz `courseId` + `isCommon`, então o pós-filtro é direto e correto. Buscar `limit × 1.5` para compensar os removidos.
- Nota: o card de IA hoje **não** filtra por matrícula (pré-existente, fora do escopo deste PR). Este endpoint **deve** filtrar. Registrar o achado do card em `FUTURE_TASKS.md` como item separado a avaliar.

### 4. Dedupe + hidratação de formato
- `hybridSearch` é chunk-level → **deduplicar por `documentId`** (melhor chunk = maior `similarity`), preservando a ordem semântica.
- Re-hidratar para o formato completo que a lista usa: `document` → `DocumentResult` (`id, title, description, category, type, url, courseId, courseName, tags, uploadedAt, isPublic`); `legislative-act` → `LegislativeActResult`. Campos ausentes no `SearchResult` (ex.: `description`, `type`, `isPublic`, `fullNumber`, `ementa`, `issuer`…) vêm de um `prisma.document.findMany`/`legislativeAct.findMany` nos IDs retornados (1 query cada). Reaproveitar os mapeamentos já existentes no `global-search`.

### 5. Escopo de tipos
- Apenas **`document`** e **`legislative-act`** migram para híbrido (estão no corpus vetorial: `DocumentChunk` + `LegislativeActChunk`). `lei`, `glossary`, `faq`, `video`, `blog`, `site` continuam FTS.

### 6. Custo
- Embedding da query **cacheado** (compartilhado com o card de IA) → **~0 de LLM**. Só a query vetorial no Postgres (barata, indexada) + 1-2 `findMany` de hidratação. **Claude não é tocado.**

## Arquitetura / arquivos

- **Criar `app/api/area-restrita/global-search/hybrid/route.ts`:**
  1. Auth + enrollments (igual `global-search`).
  2. `hybridSearch({ query, limit: N*1.5, ... })` (só ramos document+legislative-act; `includeTribunalDecisions:false`).
  3. Pós-filtro por matrícula.
  4. Dedupe por `documentId`, cortar em N.
  5. Hidratar via `findMany` nos IDs → `DocumentResult` / `LegislativeActResult`.
  6. Retornar `{ results: SearchResultItem[] }` (tipos `document`/`legislative-act`), no MESMO shape que o `global-search` usa, para merge trivial no hook.
- **Extrair helpers de mapeamento** hoje inline no `global-search/route.ts` (doc row → `DocumentResult`; act row → `LegislativeActResult`) para um módulo compartilhado, usado pelos dois endpoints. (Melhoria pontual no código que estamos tocando.)
- **Modificar `hooks/use-global-search.ts`:** nova fase — `AbortController` próprio + debounce ~800ms + trigger no submit; ao resolver, **merge**: substituir os itens `document` e `legislative-act` de `search.results` pelos híbridos, mantendo os demais tipos e re-ordenando pela mesma `typePriority`. Flag de origem (`hybrid`/`fts`) para o merge ser idempotente e para telemetria. Abortar em query nova (evita resultado velho).
- **Fallback gracioso:** erro/timeout do híbrido, embedding indisponível (429 Gemini), ou Redis off → **mantém o FTS** já exibido (zero regressão). Nunca esvaziar a lista por falha do upgrade.

## Fluxo (resumido)

```
digita → (300ms) global-search FTS → lista instantânea (todos os tipos)
       → (800ms / Enter) global-search/hybrid → docs+atos semânticos
                                              → hook faz merge (substitui só document/legislative-act)
                                              → lista refinada; foco intacto (BIA-0a já corrigiu o piscar)
```

## Testes

- **Endpoint (`hybrid/route.ts`):** (a) pós-filtro de matrícula — doc de curso não-matriculado é removido, comum/público/matriculado passa; (b) dedupe por `documentId` (2 chunks do mesmo doc → 1 resultado, melhor similarity); (c) shape hidratado completo (`DocumentResult`/`LegislativeActResult`); (d) só `document`+`legislative-act` no resultado; (e) fallback — `hybridSearch` lança → responde vazio/erro sem quebrar. (Mock de `hybridSearch`, `prisma`, auth — padrão dos testes existentes.)
- **Hook (merge):** substituir só as seções certas; manter os outros tipos; abortar query velha; fallback mantém FTS. (Se o hook não tiver harness, cobrir a **função de merge pura** extraída — testável isolada.)

## Riscos / notas
- **Acesso é o risco nº1:** o pós-filtro de matrícula é obrigatório e testado. Sem ele, vaza documento restrito na primeira impressão do produto.
- **Salto visual** no upgrade (a lista de docs reordena ~800ms depois): aceitável; o campo/foco ficam intactos (BIA-0a). Se incomodar, animar/estabilizar depois.
- **Latência do upgrade:** vetor + 1-2 findMany; alvo < 500ms. Se lento, cachear o resultado híbrido por query (curto TTL) — o `withCache` já existe.
- **Não** reabrir tuning de retrieval aqui (é near-ceiling — ver `docs/ROADMAP_BUSCA_QUALIDADE.md`). Escopo = **trocar o motor** da lista, não melhorar o ranking.

## Fora de escopo
- Melhorar o ranking do híbrido (BIA-3..7); o card de IA; a busca pública (fora da área logada); corrigir o não-filtro-por-matrícula do card de IA (registrar como item separado).
