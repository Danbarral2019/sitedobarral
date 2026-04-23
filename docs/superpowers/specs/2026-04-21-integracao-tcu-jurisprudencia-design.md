# Integração dos acórdãos TCU na página de Jurisprudência

**Data:** 2026-04-21
**Status:** Design aprovado — aguardando revisão do spec
**Autor:** Daniel Barral (via brainstorming com Claude)
**Escopo:** backend (API) — front-end não é alterado

---

## Contexto e problema

A página `/area-restrita/jurisprudencia` exibe "416 decisão(ões) encontrada(s)", mas a base catalogada tem muitos mais acórdãos do TCU que não aparecem ali. A raiz é arquitetural: a rota `/api/jurisprudencia` consulta só o modelo `TribunalDecision` (que guarda TCEs, STJ e STF via scrapers), enquanto os acórdãos do TCU vivem em `Document` com `category='acordao'` e campos `tcu*` (importados via `/admin/tcu-import` a partir de planilhas Excel exportadas do site do TCU, enriquecidos por scraper).

O dropdown "Tribunal" da UI inclusive lista `TCU — Tribunal de Contas da União`, mas selecionar retorna zero — porque a query não olha a tabela certa.

## Objetivo

Integrar os acórdãos TCU de `Document` na página de jurisprudência de forma que:

1. A listagem mostre ambos os universos unidos (TribunalDecision ∪ Document TCU).
2. Os filtros existentes (tribunal, ano, tema, artigo, tipo, relator, órgão, data, busca textual) funcionem coerentemente nos dois.
3. O "Pergunte à IA" considere acórdãos TCU ao montar o contexto enviado ao Gemini.
4. O endpoint de detalhe (`GET /api/jurisprudencia/[id]`) resolva IDs de ambas as origens.
5. **O front-end não seja alterado** — a resposta da API mantém o shape atual.

## Não-objetivo

- Migrar os acórdãos TCU de `Document` para `TribunalDecision`.
- Alterar o fluxo de importação Excel do TCU.
- Integrar outras categorias (enunciados IBDA/INCP/CJF, pareceres AGU, DECOR, ONs) — ficam para outra iteração.
- Alterar schema Prisma ou criar migração de dados.
- Adicionar `Document` TCU ao `TribunalDecisionChunk` (embeddings). A rota de IA da jurisprudência **não usa vector-search** hoje.

## Decisões arquiteturais

| # | Decisão | Alternativa descartada |
|---|---|---|
| 1 | Integração acontece apenas no **read path** da API | Migrar dados TCU para `TribunalDecision` (alto custo, risco, mexe em embeddings/highlights/favoritos) |
| 2 | `Document` permanece como fonte de verdade dos acórdãos TCU | Sincronização bidirecional / materialized view (overkill) |
| 3 | Query SQL raw com `UNION ALL` por endpoint | Duas queries Prisma + merge em memória (paginação cross-table fica imprecisa conforme a base cresce) |
| 4 | Critério de filtragem: `category='acordao' AND tcuNumeroAcordao IS NOT NULL` | Adicionar cláusula `reviewed=true` (escolhido mostrar tudo importado, equivalente ao `isRelevant=true` default do TribunalDecision) |
| 5 | Cobertura: listagem + IA + detalhe (todos os 3 endpoints) | Só listagem agora (cria inconsistência latente na API) |

## Arquitetura

```
┌─ Front (JurisprudenciaRestritaClient.tsx) — SEM MUDANÇA ──────────┐
│  Campos esperados: id, tribunalCode, decisionType, ...            │
└───────────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
    GET /api/jurisprudencia        POST /api/jurisprudencia/query
    (+ /[id])                      (IA com contexto de decisões)
              │                              │
              ▼                              ▼
    SQL raw: UNION ALL              Mesmo SQL raw (reusa helper)
    (TribunalDecision ∪             com ORDER BY por relevanceScore
     Document[TCU])                 e LIMIT topK
              │                              │
              └──────────────┬───────────────┘
                             ▼
                       PostgreSQL
```

**Princípios:**

- Shape da resposta preservado → front-end intocado.
- Uma query por endpoint — sem merge em memória, sem cache intermediário.
- Critério "o que é TCU" centralizado em um helper (`buildUnifiedJurisprudenciaQuery`).
- Flag `sourceType` opcional no payload (`'tribunal-decision' | 'document-tcu'`), não usada pelo front-end atual mas disponível para futuros badges/ícones.

## Componentes e arquivos

### Arquivos modificados (3)

1. **`app/api/jurisprudencia/route.ts`** — `GET` listagem
   Troca `prisma.tribunalDecision.findMany + count` por duas queries SQL raw via `prisma.$queryRaw`: itens paginados (com `UNION ALL + ORDER BY + LIMIT/OFFSET`) e total (`SELECT COUNT(*) FROM (UNION ALL)`).

2. **`app/api/jurisprudencia/[id]/route.ts`** — `GET` detalhe
   Tenta `TribunalDecision.findUnique`; se `null`, tenta `Document.findFirst` com critério TCU; normaliza shape via `mapDocumentTcuToDecision`.

3. **`app/api/jurisprudencia/query/route.ts`** — `POST` IA
   Substitui a query Prisma plain por chamada ao helper `fetchUnifiedTopK(filters, topK)`. Também substitui o `count` de fallback pelo `countUnifiedApproved()`.

### Arquivos novos (1)

4. **`lib/jurisprudencia/unified-query.ts`**
   Exporta:
   - `buildUnifiedJurisprudenciaQuery(filters, options)` — monta SQL raw dinâmico com short-circuit por filtro.
   - `fetchUnifiedList(filters, { page, pageSize })` → `{ items, total }` usado pela listagem.
   - `fetchUnifiedTopK(filters, topK)` → `items` usado pela IA.
   - `fetchUnifiedById(id)` → `item | null` usado pelo detalhe.
   - `countUnifiedApproved()` — fallback da IA quando não há resultados.
   - `mapDocumentTcuToDecision(doc)` — normaliza `Document` TCU para o shape de resposta.
   - `DOCUMENT_TCU_WHERE_SQL` / `documentTcuWherePrisma` — fragmentos reutilizáveis.

### Arquivos de teste (4 novos)

5. `lib/jurisprudencia/__tests__/unified-query.test.ts` — unit.
6. `__tests__/api/jurisprudencia/route.test.ts` — integration (listagem).
7. `__tests__/api/jurisprudencia/detail.test.ts` — integration (detalhe).
8. `__tests__/api/jurisprudencia/query.test.ts` — integration (IA, com mock Gemini).

### Arquivos NÃO tocados

- `JurisprudenciaRestritaClient.tsx` — shape da resposta preservado.
- `prisma/schema.prisma` — zero migração de modelo.
- `/admin/tcu-import`, `/admin/tcu-converter` — fluxo de importação intocado.
- `TcuHighlight`, `DocumentChunk`, embeddings TCU — continuam como estão.
- `lib/embeddings/vector-search.ts` — não é usado pela jurisprudência.

## Mapeamento de campos (Document TCU → shape de resposta)

### Campos diretos (1:1)

| Shape | Fonte em `Document` |
|---|---|
| `id` | `id` |
| `title` | `title` |
| `summary` | `summary` |
| `leiArticles` | `leiArticles` |
| `url` | `url` |
| `updatedAt` | `updatedAt` |

### Constantes

| Shape | Valor | Motivo |
|---|---|---|
| `tribunalCode` | `'TCU'` | Filtro escopa em TCU |
| `tribunalName` | `'Tribunal de Contas da União'` | — |
| `decisionType` | `'acordao'` | Filtro exige `category='acordao'` |
| `isRelevant` | `true` | Semântica: se está em Document com `tcuNumeroAcordao`, é relevante |
| `approvalStatus` | `'manually_approved'` | Para passar no bloqueio do `[id]` sem ajustar lógica |
| `sourceType` | `'document-tcu'` | Novo campo opcional |

### Derivados/renomeados

| Shape | Derivação | Fallback |
|---|---|---|
| `decisionNumber` | `tcuNumeroAcordao` | `title` |
| `ementa` | `tcuEmentaCompleta` | `description` → `content` → `''` |
| `fullText` | `tcuTextoCompleto` | `content` |
| `relator` | `tcuRelator` | `tcuAutorTese` |
| `orgaoJulgador` | `tcuOrgaoJulgador` | — |
| `dataJulgamento` | `tcuDataJulgamento` | — |
| `pdfUrl` | `tcuLinkPDF` | — |
| `year` | `acordaoAno` | `EXTRACT(YEAR FROM tcuDataJulgamento)` |
| `themes` (JSON) | `themes` | `JSON_BUILD_ARRAY(tcuArea, tcuTema, tcuSubtema)` removendo nulls |
| `processNumber` | `null` | Document TCU não tem equivalente |
| `dataPublicacao` | `douData` | `null` |
| `fullIdentifier` | `'TCU Acórdão ' || tcuNumeroAcordao` | — |
| `createdAt` | `uploadedAt` | — |
| `relevanceScore` | `0` | Constante; pode evoluir para derivar de `notesImportance` |

## Mapeamento de filtros da query

| Filtro | Ramo A (TribunalDecision) | Ramo B (Document TCU) |
|---|---|---|
| `tribunal='TCU'` | — (ramo pulado) | (sempre passa) |
| `tribunal='TCE-SP'` ou similar | `tribunalCode = 'TCE-SP'` | (ramo pulado) |
| `tribunal` vazio | (sem restrição) | (sem restrição) |
| `ano=2024` | `year = 2024` | `acordaoAno = 2024 OR EXTRACT(YEAR FROM tcuDataJulgamento) = 2024` |
| `tema='X'` | `themes ILIKE '%X%'` | `themes ILIKE '%X%' OR tcuArea ILIKE '%X%' OR tcuTema ILIKE '%X%' OR tcuSubtema ILIKE '%X%'` |
| `artigo='N'` | `leiArticles ILIKE '%N%'` | `leiArticles ILIKE '%N%'` |
| `decisionType='acordao'` ou vazio | `decisionType = 'acordao'` ou sem restrição | (sempre passa) |
| `decisionType ∈ {sumula, parecer_previo, decisao}` | `decisionType = 'X'` | (ramo pulado) |
| `relator='X'` | `relator ILIKE '%X%'` | `tcuRelator ILIKE '%X%' OR tcuAutorTese ILIKE '%X%'` |
| `orgao='X'` | `orgaoJulgador ILIKE '%X%'` | `tcuOrgaoJulgador ILIKE '%X%'` |
| `dataFrom` / `dataTo` | `dataJulgamento >=` / `<=` | `tcuDataJulgamento >=` / `<=` |
| `q='X'` | `title ILIKE '%X%' OR ementa ILIKE '%X%'` | `title ILIKE '%X%' OR tcuEmentaCompleta ILIKE '%X%'` |

## Query SQL raw

### Listagem (itens)

```sql
WITH unified AS (
  -- Ramo A: TribunalDecision (pulado se tribunal ∈ {TCU} ou decisionType ∉ {acordao, vazio})
  SELECT
    id,
    "tribunalCode",
    "tribunalName",
    "decisionType",
    "decisionNumber",
    title,
    ementa,
    summary,
    relator,
    "orgaoJulgador",
    "dataJulgamento",
    themes,
    "leiArticles",
    url,
    "relevanceScore",
    'tribunal-decision' AS "sourceType"
  FROM "TribunalDecision"
  WHERE "isRelevant" = true
    AND "approvalStatus" IN ('auto_approved', 'manually_approved')
    /* filtros dinâmicos mapeados para colunas de TribunalDecision */

  UNION ALL

  -- Ramo B: Document TCU (pulado se tribunal ∉ {TCU, vazio} ou decisionType ∉ {acordao, vazio})
  SELECT
    id,
    'TCU' AS "tribunalCode",
    'Tribunal de Contas da União' AS "tribunalName",
    'acordao' AS "decisionType",
    "tcuNumeroAcordao" AS "decisionNumber",
    title,
    COALESCE("tcuEmentaCompleta", description, content, '') AS ementa,
    summary,
    COALESCE("tcuRelator", "tcuAutorTese") AS relator,
    "tcuOrgaoJulgador" AS "orgaoJulgador",
    "tcuDataJulgamento" AS "dataJulgamento",
    COALESCE(themes, '[]') AS themes,
    "leiArticles",
    url,
    0 AS "relevanceScore",
    'document-tcu' AS "sourceType"
  FROM "Document"
  WHERE category = 'acordao'
    AND "tcuNumeroAcordao" IS NOT NULL
    /* filtros dinâmicos mapeados para colunas de Document */
)
SELECT * FROM unified
ORDER BY "dataJulgamento" DESC NULLS LAST, id ASC
LIMIT $pageSize OFFSET $offset;
```

### Total (count)

```sql
SELECT COUNT(*)::int AS total FROM (
  SELECT id FROM "TribunalDecision" WHERE ... UNION ALL
  SELECT id FROM "Document" WHERE ...
) sub;
```

### Top-K para IA

Mesma query sem `LIMIT/OFFSET` de paginação, mas com:

```sql
ORDER BY "relevanceScore" DESC NULLS LAST, "dataJulgamento" DESC NULLS LAST
LIMIT $topK;
```

### Short-circuit por filtro

A função builder **omite ramos inteiros** quando o filtro os exclui:

| Condição | Ramo A | Ramo B |
|---|---|---|
| `tribunal='TCU'` | ❌ pulado | ✅ |
| `tribunal='TCE-SP'` (ou qualquer ≠ TCU e não vazio) | ✅ | ❌ pulado |
| `tribunal` vazio | ✅ | ✅ |
| `decisionType ∈ {sumula, parecer_previo, decisao}` | ✅ | ❌ pulado |
| `decisionType='acordao'` ou vazio | ✅ | ✅ |

Ambos os ramos pulados (combinação absurda tipo `tribunal=TCU + decisionType=sumula`) → retorno vazio sem chamar o banco.

### Segurança

- 100% via `Prisma.sql` template tags + `Prisma.join`. Valores sempre parametrizados.
- Identificadores de coluna são constantes no código-fonte.
- Lista de valores permitidos para `tribunal` e `decisionType` validada contra enum (Zod) antes de montar a SQL — defesa em profundidade.

### Performance — novo índice parcial

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_tcu_acordao_idx"
  ON "Document" ("tcuDataJulgamento" DESC NULLS LAST)
  WHERE category = 'acordao' AND "tcuNumeroAcordao" IS NOT NULL;
```

Torna o scan do ramo B barato mesmo com Document crescendo com outros tipos. Adicionado via `npx prisma db execute` ou migration Prisma vazia com SQL manual.

## Busca com IA (detalhe de integração)

A rota `/api/jurisprudencia/query` hoje faz uma query Prisma em `TribunalDecision` por filtros, ordena por `relevanceScore DESC, dataJulgamento DESC`, pega top-K, monta prompt e chama Gemini. **Não usa embeddings.**

### Mudança

Troca a query Prisma por `fetchUnifiedTopK(filters, limit)`. Mesma função helper da listagem, só muda `ORDER BY` e usa `LIMIT` sem `OFFSET`.

### Prompt e sources — sem mudança

- Prompt usa campos genéricos (`tribunalCode`, `decisionType`, `decisionNumber`). Document TCU sai mapeado como `TCU / acordao / AC-1106/24-P`, então citações saem no formato natural `[TCU Acórdão AC-1106/24-P]`.
- Payload de `sources` já tem o shape certo. O client renderiza `tribunalBadgeColor('TCU')` com cor indigo (já preparado).

### Mensagem de base vazia

`countUnifiedApproved()` substitui o `prisma.tribunalDecision.count` do fallback atual — conta decisões em ambas as fontes para diferenciar "base vazia" de "filtros restritivos".

## Error handling

Segue padrão Fase 8 (`handleApiError`, erros semânticos, `apiLogger`):

| Cenário | Comportamento |
|---|---|
| `tribunal` desconhecido | 400 via Zod (novo schema aceita apenas códigos da constante `TRIBUNAIS`) |
| `decisionType` inválido | 400 via Zod com enum |
| Ambos ramos pulados | `{ items: [], total: 0, ... }` sem chamar banco |
| `$queryRaw` falha | `handleApiError` → 500 + Sentry (comportamento existente) |
| `/[id]` com ID inexistente | `NotFoundError('Decisão não encontrada')` |
| IA sem resultados | Mensagem amigável existente, sem mudança |
| IA com Gemini indisponível | Fallback existente (sources sem answer), sem mudança |

## Testes

### Unit — `lib/jurisprudencia/__tests__/unified-query.test.ts`

- `mapDocumentTcuToDecision` com todos campos → shape correto.
- `mapDocumentTcuToDecision` com campos faltando → fallbacks funcionam.
- `buildUnifiedJurisprudenciaQuery` com `tribunal=TCU` → só ramo B.
- `buildUnifiedJurisprudenciaQuery` com `tribunal=TCE-SP` → só ramo A.
- `buildUnifiedJurisprudenciaQuery` sem filtros → ambos.
- `buildUnifiedJurisprudenciaQuery` com `decisionType=sumula` → só ramo A.
- Short-circuit total (`tribunal=TCU + decisionType=sumula`) → retorno vazio sem query.

### Integration — `__tests__/api/jurisprudencia/route.test.ts`

- Seed: 3 TribunalDecision (TCE-SP, STJ, STF) + 2 Document TCU.
- `GET /api/jurisprudencia` → `total=5`.
- `GET /api/jurisprudencia?tribunal=TCU` → `total=2`, só TCU.
- `GET /api/jurisprudencia?tribunal=TCE-SP` → `total=1`.
- `GET /api/jurisprudencia?ano=2024` → respeita ambas tabelas.
- `GET /api/jurisprudencia?tema=pregão` → casa em `themes`, `tcuTema`, `tcuArea`, `tcuSubtema`.
- Paginação cross-table: `pageSize=2&page=1,2,3` → itens distintos, ordem cronológica correta.
- Document TCU com `tcuDataJulgamento=null` → fim da lista (NULLS LAST).

### Integration — `__tests__/api/jurisprudencia/detail.test.ts`

- ID de TribunalDecision aprovada → 200.
- ID de TribunalDecision pendente → 404.
- ID de Document TCU válido → 200 com shape normalizado.
- ID de Document não-TCU (ex: `category='parecer'`) → 404.
- ID inexistente → 404.

### Integration — `__tests__/api/jurisprudencia/query.test.ts`

- Filtros mistos → top-K inclui TCU + outros.
- `tribunal=TCU` → top-K só Document TCU.
- `sources` contém `tribunalCode='TCU'` quando aplicável.
- Mock Gemini: prompt gerado menciona acórdãos TCU corretamente.

## Rollout

Mudança **não-destrutiva, reversível, sem migração de dados**:

1. Criar índice parcial via `prisma db execute` ou migration Prisma vazia (`CONCURRENTLY`, não trava tabela).
2. Deploy em preview (Vercel).
3. Validação manual na preview:
   - Total da jurisprudência aumenta (era 416, deve aumentar com quantidade de acórdãos TCU importados).
   - Filtro "TCU" no dropdown retorna resultados (hoje retorna zero).
   - Pergunta à IA com tema tipicamente TCU cita ao menos um acórdão TCU nas sources.
4. Merge main → deploy produção.
5. Rollback plan: revert dos 4 arquivos (1 novo + 3 rotas) → volta ao comportamento anterior. Índice parcial pode ficar.

## Observabilidade

- `apiLogger.info` na listagem: `{ branchA: count, branchB: count, total }` para entender proporção TCU vs outros.
- `apiLogger.info` na IA: `{ consulted, tcuCount, tribunalDecisionCount }` para acompanhar adoção.
- Sem novo evento Sentry específico — `handleApiError` já captura 500+.

## Fora de escopo (anotado como follow-up)

- Migrar fluxo de importação Excel TCU para gravar direto em `TribunalDecision` — tech-debt se a dualidade incomodar no futuro.
- Indexar acórdãos TCU em `TribunalDecisionChunk` para uniformizar embeddings — desnecessário agora porque a IA da jurisprudência não usa vector-search.
- UI diferenciar visualmente resultados TCU via badge "via Document" — `sourceType` já virá no payload.
- Página de detalhe interna `/area-restrita/jurisprudencia/[id]` — não existe hoje; endpoint fica preparado quando for criada.
- Integrar outras categorias de `Document` (enunciados, pareceres AGU, DECOR, ONs) à jurisprudência — iteração futura.
