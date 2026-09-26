# Runbook — DOU Clipping v2

**Spec:** `docs/superpowers/specs/2026-05-03-dou-clipping-v2-design.md`
**Plano:** `docs/superpowers/plans/2026-05-03-dou-clipping-v2.md`

## Visão geral

Pipeline diário que busca normas relevantes no DOU (15 termos amplos em
`lib/dou-search-terms.ts`), descarta famílias fora de escopo com o pré-filtro
determinístico, busca o texto oficial de cada candidato, classifica via IA
editorial (prompt v2, threshold 70, piso 50), grava na fila
`/admin/clipping-dou` e envia email pro admin quando há novidades. Zero
auto-import.

## Componentes

| Item | Caminho |
|---|---|
| Cron diário | `app/api/cron/sync-dou-atos-normativos/route.ts` (8h UTC) |
| Pré-filtro de escopo | `lib/dou-escopo-prefiltro.ts` (Defesa Civil, orçamento, consulta tributária, concessão específica, ato concreto, imóvel da SPU) |
| Classificador IA | `lib/dou-editorial-classifier.ts` (recebe o texto oficial, até 3.000 caracteres) |
| Gabarito do editor | `eval/dou-triagem-2026-09.json` (607 itens julgados em 26/09/2026) |
| Avaliação | `scripts/eval-dou-prefiltro.ts` (sem custo) · `scripts/eval-dou-classificador.ts` (Gemini) |
| Email | `sendDouEditorialAlert` em `lib/email.ts` |
| Fila admin | `app/admin/clipping-dou/` |
| API admin | `app/api/admin/clipping-dou/{list,[id]/approve,[id]/reject,bulk}` |
| Health | `app/api/dou-clipping-health/route.ts` |
| Lookback CLI | `scripts/dou-lookback.ts` |
| Migração | `scripts/migrate-dou-staging-to-v2.ts` |

## Kill switch

`DOU_CLIPPING_V2_ENABLED=true|false` (env var, Vercel Production).
- `false` (default) → cron usa fluxo legacy.
- `true` → cron usa v2.
A página `/admin/clipping-dou` funciona independente da flag (lê o que
estiver no `DOUStagingDocument` com `editorialScore != null`).

## Tarefas operacionais

### Rodar o cron manualmente em dry-run

```powershell
$h = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Uri "https://profbarral.com.br/api/cron/sync-dou-atos-normativos?dryRun=true&limit=20" -Headers $h | ConvertTo-Json -Depth 4
```

Sem `dryRun=true`, faz inserts reais. Sem `&limit=`, busca até 100 por
termo (default).

### Rodar lookback dos últimos N dias

```powershell
npx dotenv -e .env.local -- tsx scripts/dou-lookback.ts --days 60
```

Adicione `--dry-run` pra simular sem inserir. **Não dispara email.**

### Inspecionar fila

- Browser: `https://profbarral.com.br/admin/clipping-dou`
- API direta (admin logado): `GET /api/admin/clipping-dou/list?ambiguous=true&actType=portaria`

### Reprocessar staging com novo prompt

Quando você muda o prompt em `lib/dou-editorial-classifier.ts`, incremente
`EDITORIAL_PROMPT_VERSION` (`'v1'` → `'v2'`). Pra reclassificar stagings
pendentes existentes, escreva um one-shot:

```typescript
// scripts/reclassify-pending.ts
const pending = await prisma.dOUStagingDocument.findMany({
  where: { finalDecision: null, editorialPromptVer: { not: 'v2' } },
});
// chame classifyEditorialBatch e atualize cada staging com os novos campos
```

Não há atalho UI — é script ad-hoc.

### Ler status

```bash
curl https://profbarral.com.br/api/dou-clipping-health
```

Campos importantes:
- `status`: `healthy` | `degraded` | `down`
- `hoursSinceLastCron`: > 30 sinaliza problema no cron
- `approvalRate30d`: < 0.4 sinaliza classificador descalibrado
- `queuePending == 0 && classifiedLast24h == 0` sinaliza busca quebrada

### Criar routine de alerta diária

Use o skill `schedule` (ou `/schedule` no CLI):

```
/schedule create "GET /api/dou-clipping-health daily 9am BRT, alert if status != healthy"
```

Depois copie o `trigger_id` retornado pra essa documentação.

## Troubleshooting

**Sintoma: fila vazia há vários dias**
- Verifique `/api/dou-clipping-health` → `classifiedLast24h`. Se 0, o cron
  pode não estar rodando — checar Vercel cron logs.
- Se cron rodou mas `queuePending=0`: ou termos restritos demais (revisitar
  `SEARCH_TERMS_V2` em `lib/dou-search-terms.ts`),
  ou classificador rejeitando tudo (rodar lookback dry-run e inspecionar
  scores).

**Sintoma: muitas rejeições manuais (`approvalRate30d < 0.4`)**
- Classificador está descalibrado pro escopo editorial. Refine system
  prompt em `lib/dou-editorial-classifier.ts:SYSTEM_PROMPT`, incremente
  `EDITORIAL_PROMPT_VERSION` e rode reclassify ad-hoc.
- Antes de publicar qualquer mudança de prompt ou de pré-filtro, meça contra o
  gabarito do editor:
  - `npx tsx scripts/eval-dou-prefiltro.ts` — tem de terminar com 0 aprovados
    descartados (sai com código 1 se atingir algum).
  - `npx dotenv -e .env.local -- npx tsx scripts/eval-dou-classificador.ts` —
    amostra de 118 itens. Medição de 26/09/2026 (prompt v2 com texto): 12/12
    aprovados chegam à fila; 3/106 rejeitados ainda chegam. Sem o texto
    oficial, o v2 perde a Portaria SEGES 6.364 (nota 45).
- Rejeições novas viram gabarito: exporte e acrescente ao JSON para que a
  próxima calibração as considere.

**Sintoma: cron perto do limite de 300 s**
- Em set/2026 o cron levava 226-288 s. A busca no DOU (15 termos paginados,
  1,5 s entre termos) consome ~175 s; texto oficial ~2 s (6 em paralelo);
  IA ~40 s. `stats.segundos` na resposta mostra o tempo por fase. O texto
  oficial para de ser buscado aos 200 s (`TEXT_FETCH_DEADLINE_MS`) e os
  candidatos restantes seguem só com o trecho da busca.

**Sintoma: erro 500 no `/admin/clipping-dou`**
- Geralmente: campo `editorialAffects` com JSON malformado. Use a função
  `safeParseArray` de `lib/utils.ts` em `app/api/admin/clipping-dou/list/route.ts`. Se o
  problema persistir, inspecione: `select id, editorialAffects from "DOUStagingDocument" where editorial_score is not null`.

**Sintoma: aprovação cria Document mas scrape/index não rodou**
- Esses dois rodam em background pós-transação. Veja logs do Vercel
  Function. Pra reprocessar manualmente: `npx tsx -e "import('./lib/legislative-scrapers/scrape-and-index').then(({scrapeAndIndexAct}) => scrapeAndIndexAct('act-id'))"`.

## Custo estimado

- Cron diário: ~$0.001-0.005/dia (Gemini 3-flash, ~50 candidatos × 700 tokens).
- Lookback 60 dias one-shot: ~$0.10-0.30 total.

## Decisões registradas

Ver tabela em `docs/superpowers/specs/2026-05-03-dou-clipping-v2-design.md#decisões-registradas`.
