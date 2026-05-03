# DOU Clipping v2 — design

**Data:** 2026-05-03
**Status:** Draft
**Autor:** Daniel Barral + Claude (sessão de brainstorming pós-análise das APIs Conecta gov.br)

## Goal

Reformar o pipeline de clipping de atos normativos do DOU (`app/api/cron/sync-dou-atos-normativos/route.ts`) pra eliminar dois problemas reais:

- **Falsos negativos**: normas relevantes (Decreto 12.926/2026 sobre redução de jornada, IN's recentes da SEGES) não são capturadas porque os 4 termos de busca são restritos demais.
- **Falsos positivos**: a fila admin acumula ruído (acórdãos de agências reguladoras setoriais, IN do IBAMA sobre licenciamento ambiental) porque o filtro `isProcurementRelated` é permissivo demais.

Estado-alvo: a fila admin vira uma "newsletter privada de DOU" enxuta (10-20 itens/semana), todos com enrichment IA (resumo, razão de relevância, áreas afetadas), entregue por email diariamente quando há novidades. Zero auto-import: o usuário aprova item a item.

## Non-goals

- Não substituir nem alterar o pipeline de clipping de jurisprudência (TCU, TCEs).
- Não criar UI pública nova — só admin.
- Não migrar `DocumentMetaDou` ou outros pipelines DOU (busca manual em `/admin/dou-filtros`, etc.) — continuam como estão.
- Não construir eval set de ground truth manual antes do lançamento (calibração via fila real nos primeiros 30 dias).
- Não implementar bulk approve/reject baseado em score (ex: "auto-aprovar tudo > 90") — usuário sempre aprova item a item conforme requisitado.

## Background — pipeline atual

`app/api/cron/sync-dou-atos-normativos/route.ts` (cron diário 8h UTC):

1. Busca DOU com 4 termos fixos: `lei 14.133`, `decreto licitação`, `instrução normativa SEGES OR MGI`, `portaria normativa licitação OR contratação`.
2. `DOUClassifier.classifyBatch` (heurística keyword) → mantém categorias `ATO_NORMATIVO`, `FONTE_AGU`, `SUMULA`.
3. `DOUClassifier.classifyBatchWithAI` reclassifica até 10 docs com baixa confiança (limite hardcoded).
4. Filtros: `isAtoNormativoGeral` (descarta atos concretos como nomeações) + `isProcurementRelated` (heurística keyword sobre licitações).
5. Dedup por `Document.douUrl`, `LegislativeAct.title`, `DOUStagingDocument.url`.
6. `shouldAutoApprove` = Presidência/MGI/SEGES + tipo elegível → cria `Document` + `LegislativeAct` direto, scrape conteúdo, index embeddings.
7. Senão → cria `DOUStagingDocument` (fila admin).
8. Detecta alterações em legislação existente (`detectModifications`) → cria `LeiArticleNote`.
9. Não dispara email.

Causa raiz: termos de busca restritos perdem normas tangenciais e relevantes (problema A); filtros heurísticos keyword têm precisão baixa pra critério editorial semântico (problema D).

## Critério editorial canônico

> Este ato exige ALGUMA ação de quem gerencia contratos administrativos federais (gestor, fiscal, pregoeiro, advogado público de contratações)?

Inclui: Lei 14.133 e regulamentação direta; atos sobre licitação, contrato, ata de RP, dispensa, convênio, fornecedor, pesquisa de preços, planejamento de contratações; e atos de direito administrativo amplo que IMPACTAM contratos vigentes (jornada de servidores, regime de teletrabalho, reorganização de unidades gestoras, novas atribuições de órgãos centrais como CGU/AGU/SEGES/MGI sobre contratações).

Exclui: atos finalísticos de órgãos setoriais (IBAMA ambiental, ANATEL telecom, ANS saúde), reorganização ministerial sem efeito contratual, normas individuais (nomeações, exonerações), atos não vinculantes ao executivo federal.

## Arquitetura

### O que é desativado

- Função `shouldAutoApprove()` em `lib/dou-normative-filter.ts` — removida do cron (zero auto-import).
- Branch "AUTO-APROVAR: criar Document + LegislativeAct" do cron — removida.
- Limite hardcoded de 10 reclassificações IA/run — sobe pra 100 (ou todos os candidatos, o que for menor).
- Função `isProcurementRelated()` heurística — substituída pelo novo classificador IA editorial. A função em si pode ficar, mas não é mais chamada no fluxo principal.

### O que é modificado

- `app/api/cron/sync-dou-atos-normativos/route.ts` — refatorado pro novo fluxo.
- `SEARCH_TERMS` expande de 4 → ~15 termos (lista combinada amplo + específico, ver Apêndice 1).
- `lib/dou-classifier.ts` — sem mudança crítica; o novo classificador editorial vive em arquivo separado.
- `prisma/schema.prisma` — adiciona campos editoriais ao `DOUStagingDocument`.
- `lib/email.ts` — adiciona `sendDouEditorialAlert(highlights)`.

### O que é novo

- `lib/dou-editorial-classifier.ts` — classificador IA dedicado com prompt editorial.
- `app/admin/clipping-dou/page.tsx` + `app/admin/clipping-dou/ClippingDouClient.tsx` — fila renovada.
- `app/api/admin/clipping-dou/list/route.ts` — GET fila com filtros/sort.
- `app/api/admin/clipping-dou/[id]/approve/route.ts` — POST aprovar (cria Document + LegislativeAct + scrape + index).
- `app/api/admin/clipping-dou/[id]/reject/route.ts` — POST rejeitar (com motivo opcional).
- `app/api/admin/clipping-dou/bulk/route.ts` — POST aprovar/rejeitar bulk.
- `app/api/dou-clipping-health/route.ts` — endpoint público de monitoramento.
- `scripts/dou-lookback.ts` — lookback CLI 60 dias.
- `scripts/dou-classifier-eval.ts` — futuro eval set (estrutura criada, conjunto-ouro vem depois).
- `lib/__tests__/dou-editorial-classifier.test.ts` — unit tests com mock Gemini.
- `lib/__tests__/dou-email-alert.test.ts` — unit tests email (sem enviar).
- `docs/RUNBOOK_DOU_CLIPPING.md` — runbook operacional.

### Schema additions (`DOUStagingDocument`)

```prisma
model DOUStagingDocument {
  // ... campos existentes ...

  // Enrichment IA editorial (Clipping v2)
  editorialScore        Int?       // 0-100 do classificador IA editorial
  editorialReason       String?    @db.Text  // 1-2 frases: "por que é relevante"
  editorialSummary      String?    @db.Text  // 2-3 frases neutras: "o que o ato faz"
  editorialAffects      String?              // JSON array: ["Lei 14.133", "contratos vigentes", ...]
  editorialActType      String?              // "decreto" | "portaria" | "in" | "lei" | "mp" | "on" | null
  editorialAmbiguous    Boolean    @default(false)
  editorialModel        String?              // ex: "gemini-3-flash-preview"
  editorialPromptVer    String?              // "v1", "v2"... pra reprocessar quando prompt mudar
  editorialClassifiedAt DateTime?

  // Origem do staging (lookback vs cron diário)
  source                String?    @default("cron") // "cron" | "lookback"

  @@index([editorialScore])
  @@index([editorialPromptVer])
}
```

### Fluxo do cron (novo)

```
Cron diário 08h UTC (sync-dou-atos-normativos) →
  if !DOU_CLIPPING_V2_ENABLED → mantém fluxo legacy (kill switch)
  else:
    1. Busca DOU com 15 termos amplos (Apêndice 1)
    2. Dedup por URL + título
    3. Filtra: isAtoNormativoGeral !== 'concreto'
    4. Classifica IA editorial em batch de 5 candidatos por chamada
    5. Pra cada candidato:
       a. score >= 70 → grava DOUStagingDocument com enrichment IA
       b. 50 <= score < 70 → grava com editorialAmbiguous=true
       c. score < 50 → descarta, conta no agregado diário
    6. Detecta alterações em legislação existente (mantém detectModifications)
    7. SE houver >=1 staging novo nesta run:
       sendDouEditorialAlert(novas_de_hoje) → email pra ADMIN_EMAIL
       (cap de 15 cards no email; "...e mais N — ver na fila" se exceder)
    8. SE 0 stagings novos: NÃO envia email.

Aprovação manual na fila /admin/clipping-dou →
  approve → cria Document + LegislativeAct + scrape conteúdo (lib/dou-scraper) +
            index embeddings (LeiIndexer + scrapeAndIndexAct) +
            marca staging imported=true, finalDecision='approved'
  reject  → marca finalDecision='rejected' + motivo opcional +
            classificationCorrect=false (feedback loop)
```

## Classificador IA editorial — contrato

### Modelo
- **Primary:** `gemini-3-flash-preview` (padrão do projeto, ver memory `project_site_barral_gemini_model.md`)
- **Fallback:** `gemini-2.5-flash` até 17/jun/2026
- **Temperature:** 0
- **Structured output:** via `response_schema` do Gemini (não JSON-em-string)
- **Batch:** 5 candidatos por chamada (reduz overhead, IA avalia individualmente cada item)

### Schema de saída (por candidato)

```ts
{
  relevant: boolean;        // derived: score >= 70
  score: number;            // 0-100
  reason: string;           // 1-2 frases: "por que é (ou não é) relevante"
  summary: string;          // 2-3 frases neutras: "o que o ato faz"
  affects: string[];        // ex: ["Lei 14.133", "contratos vigentes", "PCA", "convênios"]
  actType: "decreto" | "portaria" | "in" | "lei" | "mp" | "on" | null;
  ambiguous: boolean;       // IA está em dúvida (50 <= score < 70)
}
```

### Threshold

- `score >= 70` → fila normal
- `50 <= score < 70` → fila com badge "ambíguo"
- `score < 50` → descarta (não persiste; conta agregado diário no health endpoint)

### Prompt v1 (esboço)

```
Você é um jurista especializado em Lei 14.133/2021 e contratos administrativos federais.

Sua função: classificar se uma publicação do DOU é relevante pra um portal editorial sobre contratações públicas.

CRITÉRIO: o ato exige ALGUMA ação de quem gerencia contratos administrativos federais (gestor, fiscal, pregoeiro, advogado público de contratações)?

INCLUI:
- Lei 14.133 e regulamentação direta (decretos, portarias, IN, ON)
- Atos sobre licitação, contrato, ata de registro de preços, dispensa, convênio,
  fornecedor, pesquisa de preços, planejamento de contratações
- Atos de direito administrativo amplo que IMPACTAM contratos vigentes
  (jornada de servidores, teletrabalho, reorganização de unidades gestoras,
  novas atribuições de órgãos centrais como CGU/AGU/SEGES/MGI sobre contratações)

EXCLUI:
- Atos finalísticos de órgãos setoriais (IBAMA ambiental, ANATEL telecom, ANS saúde)
- Reorganização ministerial sem efeito contratual
- Normas individuais (nomeações, exonerações, designações pontuais)
- Atos de outros poderes não vinculantes ao executivo federal

EXEMPLOS:

[POSITIVO score 90] Decreto 12.926/2026 — Reduz jornada de servidores federais
em comissão. → Afeta contratos vigentes que dependem de gestão por servidores
em comissão; vai exigir aditivos.
affects: ["contratos vigentes", "gestão de pessoas"]

[POSITIVO score 95] IN SEGES nº 8/2026 — Atualiza procedimentos de pesquisa
de preços. → Aplicação direta da Lei 14.133, art. 23.
affects: ["Lei 14.133", "PCA", "contratos novos"]

[POSITIVO score 80] Portaria CGU nº 15/2026 — Diretrizes de auditoria de
contratos federais. → Controle interno sobre contratos vigentes.
affects: ["contratos vigentes", "controle interno"]

[NEGATIVO score 10] IN IBAMA nº 5/2026 — Procedimentos de licenciamento
ambiental. → Atividade-fim do órgão setorial; não afeta gestão de contratos.

[NEGATIVO score 15] Acórdão ANATEL nº 200/2026 — Sanção a operadora
por descumprimento contratual. → Regulatório setorial; não generalizável
pra administração de contratos federais.

[NEGATIVO score 20] Decreto 12.900/2026 — Cria Comitê Interministerial X.
→ Reorganização administrativa sem efeito direto em contratos.

[AMBÍGUO score 60] Lei 14.500 reestrutura carreira de procuradores federais.
→ Impacto indireto em quem atua na consultoria de contratos; sem leitura
do texto integral, difícil decidir.
ambiguous: true

[AMBÍGUO score 65] Portaria sobre teletrabalho de servidores. → Pode afetar
fiscalização de contratos por pregoeiros; depende de detalhes.
ambiguous: true

INSTRUÇÕES:
- Para cada item recebido, retorne JSON conforme o schema acima
- Seja honesto: se em dúvida, marque ambiguous=true e dê score 50-70
- Não invente "afeta" — só listar áreas que você consegue justificar pelo título/abstract
- Score < 50 só pra coisas claramente fora do escopo
```

### Versionamento

Campo `editorialPromptVer` no schema. Mudança de prompt = nova versão. Stagings ainda `pending` na fila podem ser reclassificados (script futuro).

### Custo estimado

- Cron diário: ~50 candidatos × ~500 tokens entrada + 200 saída × Gemini 3-flash → **~$0.001-0.005/dia**
- Lookback 60 dias one-shot: ~3000 candidatos → **~$0.10-0.30** total
- Lookback de 1 ano (worst case): ~18.000 candidatos → ~$1-2

## UI da fila — `/admin/clipping-dou`

### Layout

- **Header:** contador `X normas pendentes` + último cron rodado + próximo cron previsto.
- **Toolbar:** filtros (tipo, issuer, score range, ambíguos only, fonte cron/lookback, data) + sort (default: score desc).
- **Lista:** cards paginada (20/página), conteúdo completo visível em cada card (sem expand).
- **Empty state:** "Nenhuma norma pendente. Último cron rodou às HH:MM BRT. Próximo previsto pra DD/MM HH:MM."

### Card por norma

```
┌──────────────────────────────────────────────────────────┐
│ [PORTARIA] SEGES nº 8/2026 · MGI/SEGES   [85] ⚪ [cron] │
│ Atualiza procedimentos de pesquisa de preços             │
│ ─────────────────────────────────────────────────────── │
│ 📋 Resumo IA: Estabelece nova metodologia de pesquisa    │
│    de preços, exigindo painel de no mínimo 3 fontes      │
│    e justificativa documentada nas dispensas.            │
│                                                           │
│ 🎯 Por que está aqui: Altera diretamente o art. 23 da    │
│    Lei 14.133 e impacta todas as compras em andamento.   │
│                                                           │
│ Afeta: [Lei 14.133] [contratos vigentes] [PCA]           │
│                                                           │
│ Conteúdo (do scraping inicial — pode estar truncado):    │
│ "Considerando o disposto no art. 23 da Lei nº 14.133,    │
│ de 1º de abril de 2021, e a necessidade de uniformizar  │
│ ..."                                                      │
│                                                           │
│ [✓ Aprovar] [✗ Rejeitar] [🔗 Ver DOU] [⚙ Detalhes IA]  │
└──────────────────────────────────────────────────────────┘
```

- **Score badge:** verde (≥80), azul (70-80), amarelo + tag "ambíguo" (50-70)
- **Tag origem:** `cron` (run diário) ou `lookback` (importado pelo script CLI)
- **Detalhes IA** (modal): score, JSON completo da resposta IA, prompt version, model usado — pra debug e calibração

### Ações

- **Aprovar** → POST `/api/admin/clipping-dou/[id]/approve`:
  - Cria `Document` + `LegislativeAct` (lógica reaproveitada do antigo auto-approve em `app/api/cron/sync-dou-atos-normativos/route.ts:231-323`)
  - Dispara scrape de conteúdo (`scrapeContent` de `lib/dou-scraper`)
  - Dispara `LeiIndexer.analyzeDocument` pra vincular artigos da Lei 14.133
  - Dispara `scrapeAndIndexAct` pra index embeddings
  - Marca staging `imported=true`, `finalDecision='approved'`, `documentId=<id>`, `reviewedAt=now`, `reviewedBy=<email>`
  - Toast "Importado pra base"
  - Item desaparece da fila

- **Rejeitar** → POST `/api/admin/clipping-dou/[id]/reject`:
  - Modal opcional pedindo motivo (texto livre)
  - Marca staging `finalDecision='rejected'`, `classificationCorrect=false`, `adminNotes=<motivo>`, `reviewedAt=now`
  - Item desaparece da fila

- **Bulk** → POST `/api/admin/clipping-dou/bulk`:
  - Aceita `{ action: 'approve'|'reject', ids: [...] }`
  - Limite de 20 IDs por chamada
  - Sequencial pra não saturar Gemini/scraper

### Integração email → fila

Email `sendDouEditorialAlert` tem botão "Revisar na Fila" → link `/admin/clipping-dou?from=email&staging_ids=a,b,c`. Página detecta o param e renderiza esses IDs com border destacado no topo, resto da fila aparece embaixo.

### Coexistência com `/admin/dou-filtros`

Página existente continua existindo como ferramenta auxiliar de busca manual ad-hoc no DOU. Não é desativada. `/admin/clipping-dou` vira a ferramenta principal pro fluxo diário.

## Email — `sendDouEditorialAlert`

Espelha pattern de `sendTcuHighlightAlert` em `lib/email.ts:634`. Diferenças:

- Gradiente laranja/âmbar (vs roxo do TCU) pra diferenciar visualmente.
- Cards mostram: tipo + número + issuer + score badge, título oficial, summary (2-3 frases), reason (highlight box), tags `affects`, botões "Revisar na Fila" e "Ver DOU".
- Subject: `[DOU] X norma(s) nova(s) pra revisar`.
- Cap de 15 cards; se exceder, footer: "...e mais N normas — ver na fila completa".

Destinatário: `process.env.ADMIN_EMAIL || 'admin@profdanielbarral.com'` (mesmo padrão dos outros alerts admin).

## Lookback dos 60 dias

`scripts/dou-lookback.ts`:

```bash
npx tsx scripts/dou-lookback.ts --days 60          # default
npx tsx scripts/dou-lookback.ts --days 60 --dry-run # simular
```

Mecânica:
1. Reusa `searchLastDays(term, days)` do `lib/dou-api.ts` com os 15 novos termos.
2. Cada candidato passa pelo classificador IA (mesmo prompt v1 do cron).
3. Dedup contra `Document.douUrl`, `LegislativeAct.title`, `DOUStagingDocument.url` antes de gravar.
4. Score >= 70 → cria `DOUStagingDocument` com `source='lookback'` e `editorialPromptVer='v1'`.
5. **Não dispara email** (volume potencial alto, distrai).
6. No fim, imprime relatório: `X normas adicionadas à fila pra revisar em /admin/clipping-dou`.

## Monitoring

### Endpoint público `/api/dou-clipping-health`

Espelha `/api/conuni-health` e `/api/newsletter-health`. Retorna JSON:

```json
{
  "status": "healthy" | "degraded" | "down",
  "lastCronRunAt": "2026-05-03T08:00:42Z",
  "lastCronStatus": "success" | "error",
  "queuePending": 12,
  "queuePendingAmbiguous": 3,
  "approvalRate30d": 0.62,           // aprovados / (aprovados + rejeitados)
  "avgClassifiedPerDay7d": 47,
  "discardedBelowThreshold24h": 18,
  "lastEmailSentAt": "2026-05-03T08:01:15Z"
}
```

### Routine de alerta recorrente

Replicar pattern de `reference_site_barral_conuni_sync.md`:
- Trigger Anthropic Routines (cron remoto) que faz GET no health endpoint
- Alerta por email se: cron falhou no dia, OU `approvalRate30d < 0.4` (proxy de classificador ruim), OU `queuePending == 0` por 7 dias seguidos (proxy de busca quebrada)
- Frequência: diária, manhã

## Testing

### Unit tests novos

- `lib/__tests__/dou-editorial-classifier.test.ts`:
  - Mock Gemini, valida parsing do structured output
  - Caso de erro Gemini → retorno default (não quebra cron)
  - Schema validation (zod)
- `lib/__tests__/dou-email-alert.test.ts`:
  - Renderiza HTML sem enviar; valida estrutura, escape de HTML no título, cap de 15 cards
- `app/api/admin/clipping-dou/__tests__/approve.test.ts`:
  - Aprovar cria Document + LegislativeAct + marca staging
  - Approve em staging já approved retorna 409

### Eval set (deferred)

Estrutura do `scripts/dou-classifier-eval.ts` criada, mas conjunto-ouro construído **depois**, com decisões reais da fila nos primeiros 30 dias. Decisão registrada na pergunta 3 da Seção D do brainstorming.

### Manual smoke test

`docs/RUNBOOK_DOU_CLIPPING.md` documenta:
1. Como rodar cron manual em dry-run
2. Como rodar lookback CLI
3. Como inspecionar fila e detalhes IA
4. Como reprocessar staging com novo prompt
5. Como ler `/api/dou-clipping-health`

## Migração da fila atual

Hoje a fila está saturada de ruído ("100% ruído imprestável" — palavras do usuário).

Migration script `scripts/migrate-dou-staging-to-v2.ts`:
- Marca todos `DOUStagingDocument` com `approvalStatus='pending'` como `finalDecision='rejected'` + `adminNotes='auto-rejeitado em migração v2 do classificador (2026-05-03)'` + `reviewedBy='migration'` + `reviewedAt=now`
- **Não deleta nada** (audit trail).
- Apenas tira da fila ativa.
- Idempotente (skip se já tem `finalDecision`).

Após migration, lookback popula fila limpa.

## Rollout (ordem segura)

1. **Schema migration** (campos novos no `DOUStagingDocument`) — não-destrutivo. Deploy.
2. **Deploy do código v2** com env var `DOU_CLIPPING_V2_ENABLED=false` — código presente, inativo. Cron continua usando fluxo legacy.
3. **Migration limpa fila antiga** — `npx tsx scripts/migrate-dou-staging-to-v2.ts`. Fila zera.
4. **Roda lookback CLI manualmente** — `npx tsx scripts/dou-lookback.ts --days 60`. Você revisa fila preliminar em `/admin/clipping-dou`.
5. Se OK, ativa **`DOU_CLIPPING_V2_ENABLED=true`** no Vercel Production. O cron diário começa a usar v2 a partir do próximo run.
6. Monitora 7 dias; ajusta prompt v1 → v2 se necessário (recompila + reprocessa stagings ainda pending).
7. Ativa **routine de alerta recorrente** após 2 semanas (quando temos baseline confiável de `approvalRate30d`).

## Decisões registradas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Recall vs precision na busca | Recall > precision (cast wide net) |
| 2 | Auto-import? | **Não.** 0 auto-import, sempre humano-no-loop |
| 3 | Volume alvo na fila | 10-20 itens/semana |
| 4 | Threshold IA | 70 (50-70 ambíguo) |
| 5 | Modelo IA | gemini-3-flash-preview (fallback 2.5-flash) |
| 6 | Eval set ground truth manual | Deferred — calibrar via fila real |
| 7 | Migração da fila atual | Marcar todos pending como rejected-migration |
| 8 | Email do lookback | Não enviar (relatório CLI no fim) |
| 9 | Email do cron diário | Enviar SE houver >=1 staging novo |
| 10 | Conteúdo no card da fila | Mostrar tudo (sem expand) |
| 11 | Bulk approve | Sim, mas só ação manual (sem regra de auto) |
| 12 | Rota da nova fila | `/admin/clipping-dou` |

## Acceptance criteria

A feature está pronta quando:

- [ ] Cron diário roda em `DOU_CLIPPING_V2_ENABLED=true` por 7 dias sem erro fatal.
- [ ] `/admin/clipping-dou` renderiza fila com filtros, sort, cards completos, ações funcionando.
- [ ] Aprovação cria `Document` + `LegislativeAct` + dispara scrape + index (verificar via DB).
- [ ] Rejeição marca staging com motivo e remove da fila.
- [ ] Email `sendDouEditorialAlert` chega em `ADMIN_EMAIL` quando há novidades.
- [ ] Email NÃO chega quando 0 stagings novos.
- [ ] `/api/dou-clipping-health` retorna JSON válido com todas as métricas.
- [ ] Lookback de 60 dias adicionou ≥10 normas relevantes que estavam perdidas (ex: Decreto 12.926, IN's recentes da SEGES).
- [ ] Migração da fila antiga marcou todos os pending como rejected-migration.
- [ ] Unit tests passam (`pnpm test lib/__tests__/dou-editorial-classifier`, `lib/__tests__/dou-email-alert`).
- [ ] Runbook em `docs/RUNBOOK_DOU_CLIPPING.md` revisado pelo usuário.

## Out of scope (explicitamente fora)

- **Reprocessar `Document` antigos com IA editorial** — só processa novos a partir do deploy.
- **UI pública mostrando "atos pendentes"** — fila é só admin.
- **Webhook PNCP / outras fontes** — só DOU. PNCP fica pra `docs/ROADMAP_PNCP.md`.
- **Geração automática de notas pra Lei 14.133** após aprovação — `LeiArticleNote` continua sendo criado por `detectModifications` no cron (lógica preservada), não pela aprovação manual. Risco conhecido: classificador mais agressivo pode aumentar volume de `LeiArticleNote` criadas com `isPublic=false, adminReviewed=false`. Se virar problema, separa em ticket próprio.
- **Detecção de conflitos / sobreposição com normas existentes** — fora do MVP.
- **Histórico de versão de prompt + métricas comparativas** — só registra `editorialPromptVer` por staging; comparação fica pro futuro `dou-classifier-eval.ts` quando eval set existir.
- **Kill switch e UI**: o env var `DOU_CLIPPING_V2_ENABLED` controla SOMENTE o cron. A página `/admin/clipping-dou` existe e funciona independente da flag (lê o que estiver no `DOUStagingDocument`).

## Apêndice 1 — Lista expandida de termos de busca

Lista preliminar (15 termos) — vai pra `SEARCH_TERMS` no cron. Pode ser ajustada após primeiros 30 dias com base no que aparece (ou não) na fila:

```ts
const SEARCH_TERMS = [
  // Específicos Lei 14.133
  'lei 14.133 OR lei 14133 OR nova lei de licitações',
  'decreto licitação OR decreto contratação',
  'instrução normativa SEGES OR instrução normativa MGI',
  'portaria normativa licitação OR portaria normativa contratação',

  // Órgãos centrais — captação ampla
  'portaria SEGES OR portaria MGI',
  'instrução normativa CGU OR portaria CGU',
  'parecer AGU OR orientação normativa AGU',
  'portaria SECEX OR resolução TCU',

  // Direito administrativo amplo com efeito contratual
  'decreto servidor público federal',
  'decreto teletrabalho OR decreto jornada servidor',
  'decreto contratos administrativos federais',
  'decreto regime jurídico único',

  // Estruturais
  'decreto regulamenta lei 14.133',
  'reorganização administração federal contratações',
  'fundo de contratações OR centralização compras governo',
];
```

## Referências

- Pipeline atual: `app/api/cron/sync-dou-atos-normativos/route.ts`
- Cliente DOU: `lib/dou-api.ts`
- Classificador legacy: `lib/dou-classifier.ts`
- Filtro keyword legacy: `lib/dou-normative-filter.ts`
- Schema staging: `prisma/schema.prisma:949-1001` (`DOUStagingDocument`)
- Email pattern de referência: `lib/email.ts:634` (`sendTcuHighlightAlert`)
- Memória do projeto: `project_site_barral_pncp_roadmap.md` (relacionado ao item 4 do brainstorming pai)
- Memórias de monitoring referência: `reference_site_barral_conuni_sync.md`, `reference_site_barral_newsletter_monitor.md`
