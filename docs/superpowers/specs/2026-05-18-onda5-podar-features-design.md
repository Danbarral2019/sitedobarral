# Onda 5 — Podar features mortas

**Data:** 2026-05-18
**Status:** Aprovado (design), implementação pendente
**Onda:** 5 (Saneamento 2026-05 — campanha de 6 ondas)
**Escopo final:** 3 PRs sequenciais em `main`, cleanup de código que sobreviveu a refactors anteriores

---

## Contexto

A campanha de saneamento 2026-05 passou por 7 ondas (Ondas 1–4 + 4.5 + 4.6 + 4.7), todas focadas em **adicionar e refatorar**. A Onda 5 inverte o foco: **remover** código vestigial que sobreviveu a refactors anteriores. Três frentes identificadas via inventário em 2026-05-18:

1. **AGU scraper v1 ainda usado em prod** (cron semanal) apesar do v4 existir há meses
2. **Flag `DOU_CLIPPING_V2_ENABLED`** em cron crítico — v2 já é canônico, flag é vestígio + 444 LOC de fluxo legacy dead-code
3. **Pages admin duplicadas** `scraper-agu` vs `agu-import` — sobreviveram à consolidação T5 (commit `3c2cd52`)

Itens originalmente cogitados mas tirados do escopo após inventário:
- ❌ `/admin/assistente-social` — confirmada VIVA (aba do `BlogSocialClient` + link em `app/admin/blog/config.tsx:135`)
- ❌ Colunas MP Mercado Pago no schema — já removidas em PR anterior
- ❌ `leiArticles` legado drop — programado pra 4.5.6 em ~2026-06-01, fora desta onda

## Achados do inventário (2026-05-18)

### Frente A.1 — AGU scraper v1 → v4

| Arquivo | LOC | Uso atual |
|---|---|---|
| `lib/agu-scraper.ts` (v1) | 496 | `app/api/cron/import-documents/route.ts:4` — cron SEMANAL importa Orientações Normativas via v1 |
| `lib/agu-scraper-v4.ts` (v4) | 410 | `app/api/admin/agu-import/route.ts`, `app/api/admin/scrape-agu/route.ts`, scripts |
| `lib/agu-types.ts` | (a checar) | provável só usado pelo v1 |

**Risco:** médio — v4 pode não ter paridade comportamental com v1 pra Orientações Normativas. Mitigação: testar localmente antes do merge.

### Frente A.2 — Flag `DOU_CLIPPING_V2_ENABLED` + fluxo legacy

| Arquivo | LOC total | Linhas afetadas |
|---|---|---|
| `app/api/cron/sync-dou-atos-normativos/route.ts` | 820 | linha 118 (declaração do flag), linhas 127-577 (fluxo legacy ~444 LOC) |

Estrutura atual:
```ts
const v2Enabled = process.env.DOU_CLIPPING_V2_ENABLED === 'true';
// ...
if (v2Enabled) {
  capturedResponse = await runV2(dryRun, maxResults);
  return { metadata: { v2: true, dryRun } };
}
// ↓ fluxo legacy continua abaixo (sem alteração)  ← ~444 LOC dead code
```

**Risco:** médio — `runV2` pode reusar helpers do legacy (a verificar em **step 0** da implementação). Se reusar, a poda do legacy quebra `runV2`.

### Frente B.1 — Pages admin AGU duplicadas

| Arquivo | LOC | Hipótese |
|---|---|---|
| `app/admin/scraper-agu/page.tsx` + `ScraperAGUClient.tsx` | 474 | padrão moderno: dynamic import + ssr:false. UI base. |
| `app/admin/agu-import/page.tsx` | 545 | UI base IDÊNTICA + ~50 LOC extra: "Acervo AGU no Banco de Dados" via `useEffect` em `/api/admin/agu-stats` |

Diff: as duas têm `<h1>AGU Scraper v4</h1>`, mesma estrutura (3 seções), mesma chamada `/api/admin/scrape-agu`. **Única diferença real:** `agu-import` tem seção "Acervo AGU" no topo.

**Risco:** baixo — admin UI; impacto se quebra é cosmético, fácil de detectar.

## Arquitetura — 3 PRs sequenciais em main

Ordem **risco crescente** (lições da Onda 4.5: começar pelo simples valida o pattern de PR).

### PR 5.1 — `chore/remove-dou-clipping-v2-flag`
**Audacious:** remove flag + dropa fluxo legacy (~444 LOC) de `sync-dou-atos-normativos/route.ts`

### PR 5.2 — `refactor/consolidate-agu-admin-pages`
Porta seção "Acervo AGU" (~50 LOC) de `agu-import` → `scraper-agu`. Deleta `agu-import` inteira (545 LOC).

### PR 5.3 — `refactor/agu-scraper-v1-to-v4`
Substitui import em cron `import-documents/route.ts`. Adapta mapping de output. Deleta `lib/agu-scraper.ts` (496 LOC) e `lib/agu-types.ts` (se órfão).

**Total estimado:** ~1500 LOC removidas líquidas. Esforço total ~2 dias.

## Detalhamento por PR

### PR 5.1 — DOU flag + legacy drop

**Files:**
- Modify: `app/api/cron/sync-dou-atos-normativos/route.ts`

**Step 0 — Verificação obrigatória de paridade (ANTES de qualquer mudança):**

Grep todos os símbolos exportados/usados no bloco legacy (linhas 127-577) e confirmar que `runV2` NÃO depende deles. Se houver dependência, a poda do legacy **quebra `runV2`**.

```bash
# Identificar functions/types declarados no legacy block
sed -n '127,577p' app/api/cron/sync-dou-atos-normativos/route.ts | grep -E "^(function|const|type|interface) " | head -20

# Pra cada símbolo identificado, verificar se runV2 usa
# runV2 está nas linhas 578+
```

**Se algum símbolo do legacy é usado por `runV2`:**
- Pivotar pra "minimal" (remover só o flag, manter legacy como dead code do mesmo arquivo)
- OU mover o símbolo compartilhado pra fora do bloco legacy antes de dropar o resto
- Documentar no PR a decisão

**Step 1 — Implementação (assumindo step 0 = paridade OK):**

```ts
// REMOVE: linha 118
- const v2Enabled = process.env.DOU_CLIPPING_V2_ENABLED === 'true';

// SIMPLIFICA: linha 126 (telemetria sempre v2)
- await withCronTelemetry(v2Enabled ? 'sync-dou-atos-normativos-v2' : 'sync-dou-atos-normativos', async () => {
+ await withCronTelemetry('sync-dou-atos-normativos-v2', async () => {

// SIMPLIFICA: linhas 127-132 (executa runV2 incondicional)
- if (v2Enabled) {
-   capturedResponse = await runV2(dryRun, maxResults);
-   return { metadata: { v2: true, dryRun } };
- }
+ capturedResponse = await runV2(dryRun, maxResults);
+ return { metadata: { v2: true, dryRun } };

// DELETA: linhas 133-577 (fluxo legacy ~444 LOC)
```

**Step 2 — Verificação pós-mudança:**

```bash
npx tsc --noEmit 2>&1 | grep "sync-dou-atos-normativos" || echo "clean"
grep -rn "DOU_CLIPPING_V2_ENABLED" app lib scripts || echo "fully removed"
# Verificar que arquivo ainda compila e runV2 é único caminho
```

**Sem novos testes.** Telemetria pós-deploy validará comportamento (mesmo do v2 anterior).

### PR 5.2 — Consolidar pages AGU

**Files:**
- Modify: `app/admin/scraper-agu/ScraperAGUClient.tsx` — adiciona seção "Acervo AGU" no topo
- Delete: `app/admin/agu-import/` (diretório inteiro)

**Step 1 — Portar seção stats:**

Copiar de `app/admin/agu-import/page.tsx`:
- `useEffect` que chama `/api/admin/agu-stats` (~5 LOC)
- State `aguStats` + `statsLoading` (~3 LOC)
- JSX da seção "Acervo AGU no Banco de Dados" (~40 LOC)

Inserir em `ScraperAGUClient.tsx` no topo do return (antes do `<h1>AGU Scraper v4</h1>`).

**Step 2 — Garantir API `/api/admin/agu-stats` existe:**

```bash
ls app/api/admin/agu-stats/route.ts 2>/dev/null && echo "API exists" || echo "API MISSING — also need to port"
```

Se a API existir já: bom, manter. Se não: porta também.

**Step 3 — Deletar agu-import:**

```bash
git rm -r app/admin/agu-import/
```

**Step 4 — Confirmar zero referências:**

```bash
grep -rn "/admin/agu-import" app components 2>/dev/null | grep -v "//" || echo "no live refs"
```

**Sem novos testes.** UI test manual: abrir `/admin/scraper-agu` em dev, ver seção "Acervo AGU" carregar + scraping funcionar.

### PR 5.3 — AGU v1 → v4 migration

**Files:**
- Modify: `app/api/cron/import-documents/route.ts`
- Delete: `lib/agu-scraper.ts`
- Delete (condicional): `lib/agu-types.ts` (apenas se órfão pós-drop do v1)

**Step 0 — Auditoria de paridade v4 vs v1 para Orientações Normativas:**

```bash
# Funções exportadas por cada
grep -E "^export " lib/agu-scraper.ts | head -10
grep -E "^export " lib/agu-scraper-v4.ts | head -10

# v1 exporta: scrapeOrientacoesAGU, type OrientacaoNormativa, convertOrientacoesToDocuments
# v4 exporta: scrapeAGU (genérico, multi-tipo), convertAGUDocumentsToImport
```

Confirmar que `scrapeAGU({ type: 'orientacao-normativa' })` produz output **funcionalmente equivalente** ao `scrapeOrientacoesAGU()`.

**Step 1 — Teste local:**

```bash
npx tsx scripts/test-agu-scraper-v4.ts
# Verifica que v4 retorna ONs com mesma estrutura
```

**Step 2 — Substituir import e adaptar cron handler:**

```ts
// ANTES:
- import { scrapeOrientacoesAGU, type OrientacaoNormativa } from '@/lib/agu-scraper';
- // ...
- const ons = await scrapeOrientacoesAGU();

// DEPOIS:
+ import { scrapeAGU, convertAGUDocumentsToImport } from '@/lib/agu-scraper-v4';
+ // ...
+ const result = await scrapeAGU({ tipos: ['orientacao-normativa'] /* params equivalentes */ });
+ const ons = convertAGUDocumentsToImport(result);
```

**A forma exata da chamada será determinada pela inspeção da API de v4 durante implementação.** Pode requerer adaptação adicional do mapping pro tipo Document do cron.

**Step 3 — Drop v1:**

```bash
git rm lib/agu-scraper.ts
# Checar se agu-types.ts ainda é usado
grep -rn "from '@/lib/agu-types'" app lib --include="*.ts" 2>/dev/null
# Se zero refs:
git rm lib/agu-types.ts
```

**Step 4 — Verificação local:**

```bash
npx tsc --noEmit 2>&1 | grep -E "agu-scraper|import-documents" || echo "clean"
npm run test 2>&1 | tail -10
```

**Step 5 — Pós-deploy:**

- Esperar cron rodar (semanal) ou disparar manualmente via `?key=CRON_SECRET`
- Verificar no Sentry: cron `import-documents` completou sem erro
- Verificar contagem de ONs importadas (deve ser similar à última execução pré-migração)

## Sequência operacional

1. Branch `chore/remove-dou-clipping-v2-flag` → PR 5.1 → step 0 (paridade) → implementar → push → merge → deploy auto Vercel
2. Branch `refactor/consolidate-agu-admin-pages` (rebased em main) → PR 5.2 → implementar → push → merge → deploy
3. Branch `refactor/agu-scraper-v1-to-v4` (rebased em main) → PR 5.3 → step 0 (paridade) → step 1 (teste local) → push → merge → deploy
4. Atualizar memória local após onda fechada

## Critério de "Onda 5 fechada"

- 3 PRs (5.1, 5.2, 5.3) merged em `main`
- Run Tests verde nas 3 (com possível fail de coverage threshold global, padrão Onda 4)
- `npm run migration:api:status` = 0
- Cron `import-documents` execução pós-deploy validada (Sentry sem erros, contagem similar)
- Memória atualizada: marcar Onda 5 ✅ em `MEMORY.md`

## Itens fora do escopo desta onda

- **`leiArticles` legado drop** (PR 4.5.6) — em monitoramento até ~2026-06-01
- **Auditoria schema órfãos** — varredura sistemática de modelos/colunas sem uso. Trabalho separado se interesse no futuro.
- **Onda 6 refactor estrutural** — componentes >800 linhas, Server Components, CLAUDE.md
- **assistente-social** — confirmado vivo via auditoria, mantém
- **Tabs dos hubs** (tcu-highlights, tcu-manager, tribunal-decisions, tribunal-highlights, analytics, analytics-documentos) — todas usadas via `dynamic import` em hubs respectivos

## Riscos identificados

| Risco | Mitigação |
|---|---|
| `runV2` depende de helper do legacy DOU | Step 0 obrigatório na PR 5.1: grep símbolos do bloco legacy + verificar uso em `runV2`. Pivot pra "minimal" se houver dependência. |
| `agu-import` linkada de algum lugar não detectado | Step 4 na PR 5.2: grep final `/admin/agu-import` em toda code base antes do delete |
| `scrapeAGU(v4)` não tem paridade com `scrapeOrientacoesAGU(v1)` | Step 0 + 1 na PR 5.3: comparar APIs + teste local antes de mexer no cron. Se paridade falhar, pivotar pra "minimal" (apenas migrar imports preservando comportamento exato) |
| Cron `import-documents` quebra em prod | Step 5 na PR 5.3: monitorar Sentry pós-deploy. Cron é semanal — primeira execução real é o gate. |
| API `/api/admin/agu-stats` não existir | Step 2 na PR 5.2: verificar antes; se faltar, ou portar a API junto OU dropar a seção stats também |

## Referências

- [project_plano_saneamento.md](../../memory/project_plano_saneamento.md) — plano original com PRs 5.1-5.5
- [project_sessao_2026-05-18-onda4.7.md](../../memory/project_sessao_2026-05-18-onda4.7.md) — cadência consolidada
- [feedback_pre_launch_audacious.md](../../memory/feedback_pre_launch_audacious.md) — mantra Onda 4
