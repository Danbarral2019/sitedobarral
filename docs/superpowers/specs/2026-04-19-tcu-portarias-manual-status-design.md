# TCU Portarias — Manual Status Marker (Bundle B) — Design

**Data:** 2026-04-19
**Contexto:** Bundle B originalmente previsto para construir um parser TCU SPA. Investigação revelou que as 2 Portarias TCU afetadas (3/2025, 175/2022) já têm conteúdo **correto e completo** no banco (22.103 e 15.602 chars de texto real). O verdict `bloated` da auditoria foi falso-positivo — comparava stored (texto correto) vs live-fetch da SPA (187 chars de shell). Não há necessidade de um scraper novo. O que precisa é classificar esses atos como "conteúdo de origem manual" para prevenir re-scrape e eliminar o ruído na auditoria.

**Spec anterior:** `docs/superpowers/specs/2026-04-19-legislative-acts-extraction-fixes-design.md` (Bundle A) — fora do escopo aqui.

---

## Objetivo

Marcar atos cujo conteúdo veio de fonte externa (não auto-scraping) com um sentinela que:
1. Impede re-scrape automático (cron + scripts batch)
2. Impede que a auditoria trate como "suspicious" falso-positivo
3. Documenta a origem do conteúdo para operadores futuros

Resolve o caso imediato (2 Portarias TCU) e estabelece padrão reutilizável para futuros atos manuais (inclui Portaria MPU 178/2023 que também tem conteúdo mas sem parser PDF — será beneficiada em Bundle C ou aqui mesmo se couber).

## Abordagem

**Zero mudança de schema.** `scrapeStatus String?` já é free-text no Prisma. Introduzir o valor `'manual'` como sentinela, atualizar a documentação inline do modelo e todos os consumidores que iteram sobre `scrapeStatus`.

## Mudanças

### 1. Documentação de schema

`prisma/schema.prisma`, linha do campo `scrapeStatus`:

```prisma
scrapeStatus String? // 'success' | 'failed' | 'pending' | 'unchanged' | 'manual'
```

`'manual'` = conteúdo veio de import, admin edit, ou outra origem não-scraper. Consumidores automatizados (cron, rescrape batch) devem pular.

### 2. Script one-off `scripts/mark-atos-manual.ts`

Atualiza `scrapeStatus = 'manual'` + `scrapeError = null` para atos passados via CLI ou via hardcoded list (para reproducibilidade).

```typescript
// Uso:
//   npx dotenv -e .env.local -- npx tsx scripts/mark-atos-manual.ts
//   npx dotenv -e .env.local -- npx tsx scripts/mark-atos-manual.ts --dry-run
```

Lista inicial (hardcoded): `Portaria TCU 3/2025`, `Portaria TCU 175/2022`.

Decisão: NÃO incluir `Portaria MPU 178/2023` aqui. Ela tem conteúdo truncado (57KB stored vs 172KB stripped — é PDF mal-parseado, não texto correto). Bundle C (PDF parser) é o fix real. Se quisermos marcá-la como `manual` temporariamente até Bundle C, pode ser outro script.

### 3. `scripts/rescrape-affected-acts.ts`

A query `--include-null-status` já filtra `scrapeStatus: null` e portanto não pega atos `'manual'`. Sem mudança nessa query.

O que MUDA: na coleta de IDs de `spotCheckSuspicious` do audit JSON (primeira fonte de IDs), os atos TCU aparecem com verdict `bloated`. Precisamos filtrar IDs cujo ato está com `scrapeStatus: 'manual'` (via query adicional):

```typescript
const manualIds = new Set(
  (await prisma.legislativeAct.findMany({
    where: { scrapeStatus: 'manual' },
    select: { id: true },
  })).map(a => a.id),
);
for (const row of audit.spotCheck ?? []) {
  if (row.verdict !== 'ok' && !manualIds.has(row.id)) ids.add(row.id);
}
```

### 4. `scripts/rescrape-by-content-pattern.ts`

Na query principal, adicionar `scrapeStatus: { not: 'manual' }`:

```typescript
const all = await prisma.legislativeAct.findMany({
  where: {
    officialUrl: { not: null },
    content: { not: null },
    scrapeStatus: { not: 'manual' },
  },
  // ...
});
```

### 5. `app/api/cron/check-legislative-updates/route.ts`

Na query inicial de `actsToCheck` (linha ~32-45), adicionar `scrapeStatus: { not: 'manual' }`:

```typescript
const actsToCheck = await prisma.legislativeAct.findMany({
  where: {
    officialUrl: { not: null },
    scrapeStatus: { not: 'manual' },
    OR: [
      { lastScrapedAt: null },
      { lastScrapedAt: { lt: sevenDaysAgo } },
    ],
  },
  // ...
});
```

### 6. `scripts/audit-legislative-acts.ts` — `buildProblemIdIndex`

Na composição de `spotCheckSuspicious`, excluir IDs cujo ato tem `scrapeStatus === 'manual'`:

```typescript
const manualActs = await prisma.legislativeAct.findMany({
  where: { scrapeStatus: 'manual' },
  select: { id: true },
});
const manualIds = new Set(manualActs.map(a => a.id));

return {
  // ...
  spotCheckSuspicious: params.spotCheck
    .filter((r) => (r.verdict === 'truncated' || r.verdict === 'bloated') && !manualIds.has(r.id))
    .map((r) => r.id),
};
```

Opcionalmente, adicionar coluna informativa na seção 8 do markdown rendering: quando `scrapeStatus: 'manual'` do ato, emit verdict `'manual'` (ou prefix `[manual]` antes do verdict atual). YAGNI — só mudar se a saída ficar confusa sem isso.

## Testes

Uma suite nova `test/legislative-scrapers/manual-status.test.ts` (ou estender existentes) cobrindo:

1. `mark-atos-manual` script atualiza o campo correto (teste com mock Prisma ou DB de teste — DB de teste é complexo aqui, vou mockar Prisma).
2. `rescrape-affected-acts` filtra atos `manual` da coleta (unit test da função de seleção, se refatorada).
3. `buildProblemIdIndex` (audit) exclui atos `manual` de `spotCheckSuspicious` (unit test da função).

Para (2) e (3): melhor refatorar as funções de seleção/filtragem para pure e testáveis. Se o refactor for grande demais, aceitar teste só de (1) e validar (2)/(3) manualmente via dry-run.

**Decisão pragmática:** testar (3) via unit test (pura função, fácil), testar (1) via dry-run manual (script simples), aceitar (2) sem teste (já é coberto via dry-run do rescrape). YAGNI no teste.

## Critérios de sucesso (mensuráveis)

- [ ] 2 TCU Portarias com `scrapeStatus: 'manual'` no banco (verificado via query direta)
- [ ] `rescrape-affected-acts.ts --dry-run` NÃO lista as 2 Portarias TCU
- [ ] `rescrape-by-content-pattern.ts --dry-run` NÃO lista as 2 Portarias TCU
- [ ] Cron `check-legislative-updates` (via dry-run manual ou inspeção de código) não inclui atos `manual`
- [ ] Re-auditoria (sufixo `post-fix-v4`): `spotCheckSuspicious` cai de 10 para ≤8 (exclui os 2 TCU)
- [ ] Schema comment atualizado
- [ ] `scrape-and-index.ts` (função `scrapeAndIndexAct`) continua funcionando: se alguém chamar direto com ID de ato `manual`, deve re-scrapear normalmente (a semântica é "pule em seleção automática", não "recusa todo scrape") — OU bloquear ali também, decidir. **Decisão:** NÃO bloquear em `scrapeAndIndexAct` — é um método de baixo nível que admin pode invocar explicitamente. Bloqueio fica nas camadas de seleção (cron, scripts batch).

## Não objetivos

- Criar schema field dedicado `contentSource` (refactor maior, não justificado para 2 atos)
- UI admin para editar conteúdo manual (Opção B — sessão separada, cobre caso geral)
- Scraper TCU com Playwright (desnecessário — conteúdo já existe)
- Parser PDF para MPF (Bundle C separado)

## Riscos

| Risco | Mitigação |
|---|---|
| Desenvolvedor futuro esquece que `manual` existe e adiciona lógica que ignora | Comentário no schema + valor documentado em todos os pontos de uso; audit continua validando (excluir manual → falha de teste se esquecido) |
| Usuário admin quer re-scrapear um ato `manual` manualmente | `scrapeAndIndexAct(id)` continua funcionando — ponto de extensão preservado |
| Outros atos ficam elegíveis como `manual` no futuro | Script `mark-atos-manual.ts` aceita lista configurável; padrão estabelecido |

## Próximo passo após aprovação

Invocar `superpowers:writing-plans` com este spec como referência.
