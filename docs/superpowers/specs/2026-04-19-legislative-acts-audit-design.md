# Auditoria de LegislativeActs — Design

**Data:** 2026-04-19
**Contexto:** T1 de `FUTURE_TASKS.md` ("Correção das Extrações de Atos Normativos — TCU e MPF") está registrada desde 2026-02-23. Investigação preliminar mostrou que nenhum commit subsequente endereçou o tema e que `scripts/scrape-legislative-acts-content.ts` não possui parsers para os domínios TCU (`pesquisa.apps.tcu.gov.br`, `btcu.apps.tcu.gov.br`), caindo no fallback de `<body>` inteiro. Antes de escrever fixes, auditar o banco para confirmar o escopo real do problema.

## Objetivo

Responder com evidência às seguintes perguntas:
1. Quais issuers e quantos atos existem hoje?
2. Quantos atos têm `content` vazio, truncado ou com ruído provável?
3. Quais hosts de `officialUrl` não têm parser dedicado no scraper?
4. Há metadados essenciais faltando (número, ano, issuer, data de publicação)?
5. Há duplicatas em `(issuer, type, number, year)`?
6. Para uma amostra, o conteúdo armazenado condiz com o que a URL oficial entrega hoje?

A auditoria **não corrige nada** — só produz relatório.

## Escopo

- **Fonte única:** tabela `LegislativeAct` no banco Neon (acessado via `DATABASE_URL` do `.env.local`)
- **Fora de escopo:** `Document` (tabela separada, não coberta por T1), `TribunalDecision`, `LegislativeActChunk`
- **MPF vs MPU:** T1 menciona "MPF" mas o banco tem "MPU". A auditoria reportará issuers reais; a nomenclatura em T1 será corrigida depois com base nos achados.

## Métricas e seções do relatório

### 1. Inventário por issuer
Contagem de `LegislativeAct` agrupada por `issuer` e `type`. Tabela simples.

### 2. Distribuição de `content.length`
Buckets: `null`, `0`, `<500`, `500-2000`, `2000-5000`, `>5000` — agrupado por issuer. Identifica onde a extração provavelmente truncou.

### 3. Distribuição de `scrapeStatus`
Buckets: `null`, `success`, `failed`, `pending`, `unchanged` — agrupado por issuer. Cruzado com `lastScrapedAt` (nunca rodou vs. rodou há muito tempo).

### 4. Hosts de `officialUrl` sem parser dedicado
Listar hosts únicos (via `new URL(officialUrl).hostname`) com contagem de atos. Marcar quais têm parser específico no `scrape-legislative-acts-content.ts` hoje (`planalto.gov.br`, `*.gov.br`) vs. quais caem no fallback.

### 5. Completude de metadados
Por issuer, % de atos com cada um destes campos preenchidos: `number`, `year`, `fullNumber`, `issuer`, `publishDate`, `ementa`, `officialUrl`, `content`, `themes`, `leiArticles`.

### 6. Duplicatas candidatas
Grupos com mesmo `(issuer, type, number, year)` e count > 1. Listar IDs e `fullNumber` para inspeção manual.

### 7. Amostras de conteúdo
Para os 5 issuers com maior contagem de atos (se houver menos, todos), mostrar 3 atos cada: primeiros 300 chars + últimos 300 chars de `content` (pular atos com `content` null/vazio). Objetivo: detectar visualmente ruído (menus, breadcrumbs, "Ir para o conteúdo", footers).

### 8. Spot-check de URLs (10-15 atos sampleados)
Seleção: priorizar atos com `content.length < 1000` e `officialUrl` presente; incluir 2-3 "saudáveis" como controle.

Para cada URL sampleada:
- HTTP status
- Tamanho do HTML bruto (bytes)
- Tamanho do texto puro após `stripHtml` genérico
- `content.length` no banco
- **Ratio:** `content.length / texto_puro_length` — se < 0.5, forte indício de truncamento; se > 1.5, o conteúdo armazenado tem sujeira que o fetch atual não tem (content drift ou ruído antigo)

Delay de 2s entre fetches. Timeout de 30s por URL. Na falha, registrar erro mas continuar.

## Outputs

1. **`docs/audits/2026-04-19-legislative-acts-audit.md`** — relatório humano-legível com todas as seções acima em Markdown (tabelas + listas).
2. **`docs/audits/2026-04-19-legislative-acts-audit.json`** — dump estruturado com IDs problemáticos por categoria (`contentMissing`, `contentTruncated`, `metadataIncomplete`, `duplicateCandidates`, `unparsedHost`, `spotCheckSuspicious`). Consumido depois pelo fix para saber exatamente em que atos trabalhar.

Ambos são artefatos de relatório — não vão para o schema do banco e não são código de produção.

## Implementação

Script único: `scripts/audit-legislative-acts.ts`

- Prisma + PrismaNeon adapter (mesmo padrão dos outros scripts em `scripts/`)
- Argumentos:
  - `--spot-check-limit=N` (default 12) — número de URLs a verificar
  - `--skip-fetch` — pula seção 8 (útil em dev sem rede ou para iteração rápida)
  - `--dry-run` — executa queries e print no stdout, mas não grava os arquivos de saída
- Sem mutações — só `findMany`, `groupBy`, `count`
- Logs com o `apiLogger` do projeto? Não: é script standalone, `console.log` simples é suficiente

## Critérios de aceitação

- [ ] Script roda end-to-end contra Neon sem erro
- [ ] Relatório `.md` gerado com as 8 seções, legível e acionável
- [ ] JSON estruturado gerado com IDs por categoria
- [ ] Spot-check respeita delay/timeout e não derruba o script se um fetch falhar
- [ ] Saída do relatório permite decidir o escopo exato dos fixes (ex: "prioridade 1: adicionar parser para `pesquisa.apps.tcu.gov.br`, afeta N atos")

## Não objetivos

- Não aplicar fixes à extração
- Não mexer em schema
- Não reclassificar/re-embeddar atos existentes
- Não cobrir `Document` (tabela separada, outro fluxo)

## Próximo passo após aprovação

Invocar `superpowers:writing-plans` para detalhar as etapas de implementação do script.
