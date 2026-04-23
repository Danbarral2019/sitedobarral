# IA da Jurisprudência com busca semântica + fix do pipeline de indexação

**Data:** 2026-04-22
**Status:** Design aprovado — aguardando revisão do spec
**Autor:** Daniel Barral (via brainstorming com Claude)
**Escopo:** backend (rota IA + vector-search + pipeline de indexação) + script operacional. Front-end não é alterado.

---

## Contexto e problema

Após a PR anterior (integração dos acórdãos TCU na listagem de jurisprudência — `docs/superpowers/specs/2026-04-21-integracao-tcu-jurisprudencia-design.md`), dois problemas residuais:

1. **A IA da jurisprudência não faz busca semântica.** A rota `POST /api/jurisprudencia/query` usa `fetchUnifiedTopK` que ordena por `relevanceScore DESC, dataJulgamento DESC` e pega top-K. Perguntas temáticas sem filtro explícito dependem do que casualmente tem score alto ou é recente — não do que semanticamente responde à pergunta. Validação em produção: pergunta sobre "entendimento do TCU sobre segregação de funções" retornou 6 decisões do TCE-PE (recentes), zero TCU.

2. **Novas decisões importadas pelo cron não chegam à busca IA em tempo hábil.** O sistema tem auto-indexação (`process-index-jobs` a cada 15min), mas está sub-dimensionado:
   - `MAX_JOBS_PER_RUN = 10` (capacidade 960/dia)
   - Backlog atual: 157 Documents pending + 570 TribunalDecisions pending = 727
   - Ordenação LIFO (`createdAt DESC`) — backlog antigo nunca drena
   - Evidência: TCE-PE aprovadas há 2 dias ainda pending; acórdãos TCU de 4 dias atrás ainda pending

## Objetivo

1. Migrar a rota IA (`POST /api/jurisprudencia/query`) para usar busca semântica via `lib/embeddings/vector-search.ts`, incluindo todas as fontes TCU já indexadas: **acórdãos**, **consultas TCU**, **informativos** (1970 docs, 100% indexados — gold standard), **manuais TCU** e **enunciados** IBDA/INCP/CJF.

2. Corrigir o pipeline de indexação para que novas decisões importadas pelo cron sejam catalogadas automaticamente em latência ≤ 15 min.

3. Backfill one-shot dos 727 registros pending após deploy.

## Não-objetivo

- Mudar o front-end (`JurisprudenciaRestritaClient.tsx`).
- Alterar schema Prisma.
- Tocar a rota de listagem (`GET /api/jurisprudencia`) ou a rota de detalhe (`GET /api/jurisprudencia/[id]`) — seguem usando `fetchUnifiedList/ById` da PR anterior.
- Integrar `LegislativeActChunk` na IA de jurisprudência (atos legislativos não são jurisprudência — ficam no chat RAG do assistente).
- Adicionar trigger fire-and-forget pós-sync (avaliado, rejeitado — ver "Fora de escopo").
- UI de indicador de relevância com base no `similarity` (campo virá no payload mas renderização fica para PR futura).

## Decisões arquiteturais

| # | Decisão | Alternativa descartada |
|---|---|---|
| 1 | Escopo amplo de fontes: decisões + informativos + manuais + enunciados | Escopo estrito (só decisões) perde o valor dos informativos como agregadores de jurisprudência |
| 2 | Backfill em massa das 407 TribunalDecisions sem embeddings | Aceitar cobertura parcial (custo ~$0.26 é trivial) |
| 3 | Substituição total da rota IA — `semanticSearch` é a única fonte de candidatos | Cascade (vector + top-K fallback) adiciona complexidade sem ganho claro dado threshold dinâmico |
| 4 | Enunciados só aparecem quando não há filtro de tribunal | Aparecer sempre é UX confuso ("filtrei TCU e apareceu IBDA"); nunca aparecer perde valor em queries sem filtro |
| 5 | Shape uniforme dos `sources` (preserva contrato front-end) | Shape discriminante exigiria PR no front-end junto |
| 6 | Fix do pipeline de indexação incluído no mesmo PR | Separar em PR só desloca o problema sem resolver a latência de ingestão |
| 7 | Fire-and-forget pós-sync fica fora (usa `waitUntil` e exige nova dep) | Incluir agora — latência de 15 min do cron corrigido é aceitável |

## Arquitetura

```
┌─ Front (JurisprudenciaRestritaClient.tsx) — SEM MUDANÇA ──────────────┐
│  sources[].{id, tribunalCode, decisionType, decisionNumber, ...}      │
└───────────────────────────────────────────────────────────────────────┘
              │
              ▼
    POST /api/jurisprudencia/query    (mudança só aqui)
              │
              │ 1. Zod validate + toJurisprudenciaFilters
              │ 2. NOVO: mapFiltersToSemanticOptions(filters)
              │    └─ camada "adapter" jurisprudência → vector-search
              │ 3. NOVO: semanticSearch(query, options)
              │    └─ vector-search.ts (EXTENSÕES retrocompatíveis)
              │ 4. NOVO: enrichSources(results)
              │    └─ JOIN em paralelo (Document + TribunalDecision)
              │ 5. NOVO: adaptToSourcesPayload(enriched)
              │    └─ shape uniforme por categoria de origem
              │ 6. buildPrompt + Gemini + response  (igual antes)
              ▼
         PostgreSQL + pgvector

Pipeline de indexação (paralelo):
   crons sync (TCU acórdãos, TCU informativos, TribunalDecisions, DOU)
         │ marcam embeddingStatus='pending'
         ▼
   /api/cron/process-index-jobs (cada 15 min — CORRIGIDO)
         │ 50 jobs/run (antes: 10)
         │ FIFO (antes: LIFO)
         │ Batches paralelos de 5
         ▼
   processDocument / processTribunalDecision → DocumentChunk / TribunalDecisionChunk
```

**Princípios:**

- **Backend-only:** shape de resposta preservado. Front-end não muda.
- **Retrocompatibilidade do vector-search:** extensões são aditivas — busca global e chat RAG do assistente continuam funcionando idênticos.
- **`fetchUnifiedTopK` não é tocado:** a rota IA para de chamar, mas a função fica disponível para outros usos.
- **Backfill isolado:** o script é idempotente e pode ser executado antes ou depois do merge. Pipeline corrigido resolve backlog em ~1-2h sozinho; script acelera para minutos.

## Componentes e arquivos

### Arquivos modificados (5)

1. **`app/api/jurisprudencia/query/route.ts`** — rota IA
   - Substitui `fetchUnifiedTopK + countUnifiedApproved` por `semanticSearch()` + helpers do adapter novo
   - Preserva: `withAuth`, `runtime='nodejs'`, `maxDuration=60`, `GEMINI_API_KEY` check, `bodySchema`, `buildPrompt` estrutura geral (com adição de "Trecho relevante"), Gemini call, fallbacks (Gemini erro, debug)

2. **`lib/embeddings/vector-search.ts`** — extensão retrocompatível
   - Novas opções:
     - `categoryIn?: string[]` — filtro em lista de categorias (complementa o `category` singular existente)
     - `skipDocumentBranch?: boolean` (default `false`)
     - `skipLegislativeActBranch?: boolean` (default `false`)
     - `tribunalCodeFilter?: string` — filtra `TribunalDecisionChunk` por `tribunalCode` específico
     - `extraWhere?: { document?: Prisma.Sql; tribunalDecision?: Prisma.Sql }` — fragmentos SQL extras por ramo
   - Comportamento default **idêntico** ao atual quando as novas opções não são passadas

3. **`app/api/cron/process-index-jobs/route.ts`** — fix do pipeline
   - `MAX_JOBS_PER_RUN: 10 → 50`
   - Ordenação FIFO (`asc` no `uploadedAt`/`createdAt`)
   - Processamento em batches paralelos de 5 via `Promise.all`
   - Time budget: aborta graceful se `Date.now() - startTime > 250_000` (50s de margem antes de `maxDuration=300`)

4. **`app/api/jurisprudencia/__tests__/query.test.ts`** — ajuste dos mocks
   - Troca `fetchUnifiedTopK/countUnifiedApproved` por `semanticSearch` + `enrichSources` + `adaptToSourcesPayload` mockados
   - Mantém os 4 testes de comportamento (happy path, base vazia, filtros restritivos, Gemini falha)
   - Adiciona 2 testes novos (cobertura das decisões 1 e 5)

### Arquivos novos (3)

5. **`lib/jurisprudencia/semantic-adapter.ts`** — helper da camada
   - `mapFiltersToSemanticOptions(filters: JurisprudenciaFilters): SearchOptions`
   - `enrichSources(results: SearchResult[]): Promise<EnrichedSource[]>`
   - `adaptToSourcesPayload(enriched: EnrichedSource[]): JurisprudenciaSource[]`
   - `resolveEmenta(doc)`, `deriveInformativoNumber(doc)`, `mapEntityToTribunalCode(entityType)` — utilitários internos

6. **`lib/jurisprudencia/__tests__/semantic-adapter.test.ts`** — unit tests

7. **`app/api/cron/__tests__/process-index-jobs.test.ts`** — unit tests do fix do pipeline

### Script operacional (1)

8. **`scripts/backfill-pending-embeddings.ts`** — acelerador one-shot
   - Processa todos os `embeddingStatus ∈ (NULL, 'pending')` em paralelo (batches de 20)
   - Idempotente (skip de `completed`)
   - Flags: `--limit N`, `--type document|tribunal|both` (default both), `--dry-run`
   - Uso: `npx tsx scripts/backfill-pending-embeddings.ts`

### Arquivos NÃO tocados

- `JurisprudenciaRestritaClient.tsx` (front-end)
- `prisma/schema.prisma`
- `lib/jurisprudencia/unified-query.ts` (helper da PR anterior fica disponível)
- `app/api/jurisprudencia/route.ts` e `[id]/route.ts` (listagem e detalhe)
- `lib/embeddings/document-processor.ts`, `lib/embeddings/tribunal-decision-processor.ts` (já funcionam)
- Crons de sync TCU (fire-and-forget fica fora)

## Escopo de fontes na IA (regra completa)

Quando a rota IA é chamada, os candidatos que podem ser citados:

| Categoria / Origem | Quando entra |
|---|---|
| `Document` `category='acordao'` (TCU) | Sempre que filtro permitir |
| `Document` `category='consulta_tcu'` | Idem |
| `Document` `category='informativo'` (TCU) | Idem |
| `Document` `category='manual-tcu'` | Idem |
| `Document` `category='enunciados'` (IBDA/INCP/CJF) | Apenas quando `filters.tribunal` vazio |
| `TribunalDecision` (TCEs, STJ, STF) | Sempre que filtro permitir |
| `LegislativeAct` (leis, decretos) | NUNCA (não é jurisprudência) |
| Outras categorias Document (`decor`, `orientacao-normativa`, etc.) | NUNCA nesta rota |

## Mapeamento de filtros UI → `SearchOptions`

### Filtro `tribunal` (principal)

| `filters.tribunal` | `skipDocumentBranch` | `categoryIn` | `includeTribunalDecisions` | `tribunalCodeFilter` |
|---|---|---|---|---|
| `'TCU'` | `false` | `['acordao','consulta_tcu','informativo','manual-tcu']` | `false` | — |
| `'TCE-SP'` etc (≠ TCU) | `true` | — | `true` | `'TCE-SP'` |
| vazio | `false` | `['acordao','consulta_tcu','informativo','manual-tcu','enunciados']` | `true` | — |

`skipLegislativeActBranch: true` é **sempre** passado pela rota IA de jurisprudência.

### Filtro `decisionType`

- `'acordao'` ou vazio → ramo Document permanece completo (informativos compilam acórdãos; manuais e enunciados só entram quando vazio)
- `'sumula'`, `'decisao'`, `'parecer_previo'` → `skipDocumentBranch: true` (só TribunalDecision com esse `decisionType`)

### Filtros textuais/estruturais (`ano`, `tema`, `artigo`, `relator`, `orgao`, `dataFrom/dataTo`, `q`)

Viram fragmentos `Prisma.Sql` em `extraWhere.document` / `extraWhere.tribunalDecision`, reusando os builders existentes (`buildTribunalDecisionWhere`, `buildDocumentTcuWhere` da PR anterior) com duas adaptações:

1. Remover a condição base `category IN ('acordao','consulta_tcu')` de `buildDocumentTcuWhere` (passou a ser `categoryIn` no vector-search)
2. Adicionar `buildDocumentGenericWhere(filters)` para o caso "enunciados" (filtros como `relator`/`tcuRelator` não se aplicam; só `q` sobre title/description faz sentido)

### Tratamento especial do filtro `q`

Mantido como **hard filter ILIKE** (parte do `extraWhere`). Semântica clara: `q` restringe o conjunto; a pergunta em linguagem natural dirige a busca semântica. `q` não é misturado no embedding (evita sinais conflitantes).

## Enriquecimento e payload

### `enrichSources(results)` — pós-busca

`vector-search.ts` retorna `SearchResult` básico (id, title, category, url, similarity, chunkContent, sourceType). Campos específicos de jurisprudência (`decisionNumber`, `relator`, `orgaoJulgador`, `dataJulgamento`, `ementa`, `summary`, `themes`, `leiArticles`) vêm de duas queries paralelas:

```ts
async function enrichSources(results: SearchResult[]): Promise<EnrichedSource[]> {
  const docIds = results.filter(r => r.sourceType === 'document').map(r => r.documentId);
  const tdIds  = results.filter(r => r.sourceType === 'tribunal-decision').map(r => r.documentId);
  const [docs, tds] = await Promise.all([
    docIds.length ? prisma.document.findMany({
      where: { id: { in: docIds } },
      select: { /* campos necessários + categoria */ }
    }) : [],
    tdIds.length ? prisma.tribunalDecision.findMany({
      where: { id: { in: tdIds } },
      select: { /* campos diretos */ }
    }) : []
  ]);
  return results.map(r => ({ ...r, ...lookupByIdAndType(docs, tds, r) }));
}
```

Resultado órfão (chunk aponta pra doc deletado) → skip silencioso + `apiLogger.warn`.

### `adaptToSourcesPayload` — shape uniforme

| Origem | `tribunalCode` | `tribunalName` | `decisionType` | `decisionNumber` | `relator` | `dataJulgamento` |
|---|---|---|---|---|---|---|
| TribunalDecision | campo direto | campo direto | campo direto | campo direto | campo direto | campo direto |
| Document `acordao` / `consulta_tcu` | `'TCU'` | `'Tribunal de Contas da União'` | `'acordao'` | `tcuNumeroAcordao` ou `title` | `tcuRelator ?? tcuAutorTese` | `tcuDataJulgamento` |
| Document `informativo` | `'TCU'` | `'Tribunal de Contas da União'` | `'informativo'` | derivado de `title` (regex `Informativo\s+\w+\s+nº\s+\d+.*`) ou `title` | `null` | `douData ?? uploadedAt` |
| Document `manual-tcu` | `'TCU'` | `'Tribunal de Contas da União'` | `'manual'` | `title` | `null` | `uploadedAt` |
| Document `enunciados` | `entityType` (IBDA/INCP/CJF) | nome derivado | `'enunciado'` | `enunciadoNumber` | `null` | `uploadedAt` |

Campos sempre presentes no payload: `id, tribunalCode, tribunalName, decisionType, decisionNumber, title, relator, orgaoJulgador, dataJulgamento, url, sourceType, similarity`.

`similarity` (float 0-1) entra no payload — front-end atual ignora; opcional para UI futura.

### Prompt Gemini

Adição pequena ao `buildPrompt` — inclui o `chunkContent` do vector-search como "Trecho relevante":

```
[idx] ${tribunalCode} ${decisionType} ${decisionNumber} — ${date}
Título: ...
Órgão: ... | Relator: ...
Temas: ... | Artigos Lei 14.133: ...
Ementa: ${ementa truncate 800}
Trecho relevante (similaridade ${(similarity*100).toFixed(0)}%): ${chunkContent truncate 600}
Resumo IA: ${summary truncate 600}
```

Ajuda o Gemini a entender por que o doc é relevante.

## Fix do pipeline de indexação

### `app/api/cron/process-index-jobs/route.ts`

Três mudanças:

1. **`MAX_JOBS_PER_RUN: 10 → 50`**
2. **Ordenação FIFO** — `orderBy: { uploadedAt/createdAt: 'asc' }` em ambos os `findMany` (Documents e TribunalDecisions)
3. **Batches paralelos de 10** (aproveitando tier Gemini paid de 3000 RPM):

```ts
const BATCH_SIZE = 10;
const TIME_BUDGET_MS = 250_000;

for (let i = 0; i < pendingDocuments.length; i += BATCH_SIZE) {
  const batch = pendingDocuments.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.all(batch.map(doc =>
    processDocument(doc.id).catch(err => ({ success: false, error: String(err) }))
  ));
  results.push(...batchResults.map((r, idx) => ({
    jobId: `direct-${batch[idx].id}`,
    documentId: batch[idx].id,
    status: r.success ? 'completed' : 'failed',
    error: r.error,
    chunkCount: r.stats?.chunkCount,
  })));
  if (Date.now() - startTime > TIME_BUDGET_MS) {
    apiLogger.warn({ processedSoFar: i + BATCH_SIZE, remaining: pendingDocuments.length - i - BATCH_SIZE }, 'process-index-jobs time budget exhausted');
    break;
  }
}
```

Mesmo padrão aplicado ao loop de `pendingDecisions`.

Rate limits Gemini paid: 3000 RPM. 10 req paralelos × ~500ms cada = ~1200 RPM efetivo — folgado.

### Capacidade resultante

- Antes: 10 jobs/run × 96 runs/dia = 960 jobs/dia
- Depois: 50 jobs/run × 96 runs/dia = **4 800 jobs/dia**
- Backlog atual (727) drena em ~4h após deploy. Script de backfill acelera para ~10min.

## Script `scripts/backfill-pending-embeddings.ts`

```ts
// Pseudocódigo — detalhes no plano
const BATCH = 20; // sem timeout Vercel aqui; tier Gemini paid suporta
const pendingDocs = await prisma.document.findMany({
  where: { embeddingStatus: { in: [null, 'pending'] } },
  select: { id: true },
  orderBy: { uploadedAt: 'asc' },
});
for (let i = 0; i < pendingDocs.length; i += BATCH) {
  const batch = pendingDocs.slice(i, i + BATCH);
  await Promise.all(batch.map(d => processDocument(d.id).catch(e => ({ error: e }))));
  if (i % 50 === 0) console.log(`${i}/${pendingDocs.length} docs`);
}

const pendingTds = await prisma.tribunalDecision.findMany({
  where: {
    approvalStatus: { in: ['auto_approved', 'manually_approved'] },
    embeddingStatus: { in: [null, 'pending'] },
  },
  select: { id: true },
  orderBy: { createdAt: 'asc' },
});
// ...same pattern
```

Flags: `--limit N`, `--type document|tribunal|both`, `--dry-run`. Idempotente.

Custo estimado: **~$0.26** (730 registros × ~3 chunks × 800 tokens × $0.00015/M).

## Error handling

| Cenário | Comportamento |
|---|---|
| Zod inválido | 400 (já existente) |
| `semanticSearch` retorna `[]` mesmo com threshold 0.40 | Mensagem amigável + `totalInDatabase` via `countUnifiedApproved` |
| `semanticSearch` erro | `handleApiError` → 500 + Sentry + `apiLogger.error` |
| `enrichSources` erro (DB down) | Bubble up → 500 |
| `enrichSources` órfão (chunk → doc deletado) | Skip silencioso + `apiLogger.warn` |
| `adaptToSourcesPayload` falha ao derivar `decisionNumber` | Fallback `title` — shape sempre válido |
| Gemini sintetização falha | Fallback existente (sources + answer "Não consegui gerar síntese...") — sem mudança |
| `process-index-jobs` timeout | Break graceful + `apiLogger.warn` com contagens |
| `processDocument`/`processTribunalDecision` individual falha | Marca `embeddingStatus='failed'` (comportamento atual). Batch continua |

## Testes

### Unit — `lib/jurisprudencia/__tests__/semantic-adapter.test.ts` (novo)

- `mapFiltersToSemanticOptions({})` → todas categorias incluídas, LegActs skipped
- `{tribunal:'TCU'}` → categoryIn 4 categorias, includeTD=false, skipLegActs=true
- `{tribunal:'TCE-SP'}` → skipDocs=true, includeTD=true, tribunalCodeFilter='TCE-SP'
- `{tribunal:'',decisionType:'sumula'}` → skipDocs=true
- `{tema:'pregão',ano:2024,tribunal:'TCU'}` → extraWhere.document compõe filtros corretos
- `adaptToSourcesPayload` cobre 5 origens (TribunalDecision, acordao, consulta_tcu, informativo, manual-tcu, enunciado)
- `resolveEmenta` fallback chain

### Unit — `lib/embeddings/__tests__/vector-search.test.ts` (modifica/novo)

- `categoryIn` gera `IN (...)` no SQL
- `skipDocumentBranch=true` omite ramo document
- `skipLegislativeActBranch=true` omite ramo legact
- `tribunalCodeFilter` adiciona WHERE no ramo TribunalDecision
- `extraWhere.*` compõe corretamente

### Integration — `app/api/jurisprudencia/__tests__/query.test.ts` (modifica)

- Substitui mocks (`fetchUnifiedTopK` → `semanticSearch`; `countUnifiedApproved` permanece)
- Mantém 4 testes de comportamento da PR anterior
- 2 testes novos: "categorias amplas quando sem filtro" e "cita informativo quando semantic retorna informativo"

### Unit — `app/api/cron/__tests__/process-index-jobs.test.ts` (novo)

- MAX=50 respeitado (`take` passado)
- Ordenação `asc`
- Batches de 5 em paralelo — mock `processDocument` verifica concorrência
- Time budget — mock `Date.now` para timeout, sem chamar mais batches

### Script

Sem teste automático. `--dry-run` testa listagem sem processar. Logs verificáveis manualmente.

## Observabilidade

- `apiLogger.info` rota IA: `{consulted, tcuCount, informativoCount, manualCount, enunciadoCount, tribunalDecisionCount, avgSimilarity, cached, latencyMs}`
- `apiLogger.info` `process-index-jobs`: `{pendingBefore, processedInRun, remaining, durationMs, byType}`
- Sem novo evento Sentry

## Rollout

**Ordem crítica — pipeline primeiro, código IA em seguida:**

1. **Merge + deploy** — fix do `process-index-jobs` entra no primeiro cron após deploy (≤ 15 min)
2. **Rodar backfill em produção** (acelera drenagem):
   ```bash
   DATABASE_URL="<prod>" npx tsx scripts/backfill-pending-embeddings.ts
   ```
   Tempo: ~10 min. Custo: ~$0.26.
3. **Validar drenagem:** `embeddingStatus='completed'` próximo do total em Document e TribunalDecision
4. **Testar em produção:**
   - `/area-restrita/jurisprudencia` — pergunta temática sem filtro → IA cita informativo TCU
   - Filtro `tribunal=TCU` → só fontes TCU (acórdãos, informativos, manuais)
   - Filtro `tribunal=TCE-SP` → só TCE-SP (com embeddings após backfill)
5. **Monitorar `/api/cron/process-index-jobs`** nas próximas 24h — backlog deve ficar em 0

## Rollback

- **Código:** revert dos 5 arquivos modificados. Front-end intocado.
- **Backfill:** não precisa rollback — registros `completed` ficam úteis para busca global (que já usa vector-search).
- **Pipeline:** se o `process-index-jobs` novo causar problema, revert daquele arquivo especificamente volta ao comportamento anterior.

## Fora de escopo (follow-ups anotados)

- **Trigger imediato pós-sync** (`waitUntil` do `@vercel/functions`) — reduz latência de "≤15min" para "segundos" após ingestão
- **Rerank com LLM** após vector-search — melhora qualidade do top-K
- **Cache do enriquecimento** (atual 1 `findMany` extra por request)
- **UI de indicador de relevância** via `similarity` no payload — PR front-end-only
- **Índice pgvector HNSW** — se latência > 500ms em produção
- **Extensão do escopo de fontes** na rota IA para incluir `decor`, `orientacao-normativa`, `parecer-vinculante` — útil para compliance/AGU queries, fora do foco atual (TCU)
